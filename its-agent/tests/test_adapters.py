import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from occupied_agent.adapters import aruba_central, cisco_catalyst, cisco_meraki, csv_file, juniper_mist
from occupied_agent.net import ReadOnlyViolation

from helpers import ROOT, FakeController, write

SECRETS = {
    "T_KEY": "test-key",
    "T_USER": "observer",
    "T_PASS": "pw",
    "T_ID": "client-id",
    "T_SECRET": "client-secret",
    "T_REFRESH": "first-refresh-token",
}


@mock.patch.dict(os.environ, SECRETS)
class AdapterTest(unittest.TestCase):
    def assert_only_gets(self, client, allowed_posts=()):
        for method, path, _ in client.calls:
            self.assertTrue(method == "GET" or (method == "POST" and path in allowed_posts), f"{method} {path}")

    def test_meraki(self):
        org = "/organizations/123"
        client = FakeController({
            ("GET", f"{org}/devices"): "meraki_devices.json",
            ("GET", f"{org}/wireless/clients/overview/byDevice"): [
                ("meraki_by_device.json", {"Link": '<https://controller.test/organizations/123/wireless/clients/overview/byDevice?startingAfter=x>; rel=next'}),
                "meraki_by_device_page2.json",
            ],
        })
        counts = cisco_meraki.Adapter({"org_id": "123", "api_key_env": "T_KEY"}, client).get_client_counts()
        # Named AP by name, unnamed AP by serial, AP missing from the device list by serial.
        self.assertEqual(counts, {"WEL-1-AP01": 34, "Q2AA-AAAA-0002": 5, "Q2AA-AAAA-0003": 12})
        self.assertEqual(client.headers["Authorization"], "Bearer test-key")
        self.assert_only_gets(client)

    def test_mist(self):
        site = "4ac1dcf4-9d8b-7211-65c4-057819f0862b"
        client = FakeController({
            ("GET", "/api/v1/orgs/org-1/sites"): "mist_sites.json",
            ("GET", f"/api/v1/sites/{site}/stats/devices"): "mist_stats.json",
        })
        counts = juniper_mist.Adapter({"org_id": "org-1", "api_token_env": "T_KEY"}, client).get_client_counts()
        self.assertEqual(counts, {"UCC-SPOKE-AP01": 57, "FXLH2015170018": 3})  # unnamed → serial, never MAC
        self.assertIn("type=ap", client.calls[1][2])
        self.assert_only_gets(client)

    def test_aruba_refreshes_token_and_saves_the_new_one(self):
        token_file = Path(tempfile.mkdtemp()) / "aruba_token.json"
        client = FakeController(
            {("POST", "/oauth2/token"): "aruba_token.json", ("GET", "/monitoring/v2/aps"): "aruba_aps.json"},
            login_paths=aruba_central.LOGIN_PATHS,
        )
        settings = {"client_id_env": "T_ID", "client_secret_env": "T_SECRET", "refresh_token_env": "T_REFRESH", "token_file": str(token_file)}
        counts = aruba_central.Adapter(settings, client).get_client_counts()
        self.assertEqual(counts, {"REC-WT-AP01": 41, "REC-POOL-AP01": 2})
        self.assertEqual(client.headers["Authorization"], "Bearer new-access-token")
        self.assertIn("refresh_token=first-refresh-token", client.calls[0][2])
        self.assertEqual(json.loads(token_file.read_text()), {"refresh_token": "new-refresh-token"})
        self.assert_only_gets(client, aruba_central.LOGIN_PATHS)

    def test_catalyst(self):
        client = FakeController(
            {
                ("POST", "/dna/system/api/v1/auth/token"): "catalyst_token.json",
                ("GET", "/dna/intent/api/v1/device-health"): "catalyst_health.json",
            },
            login_paths=cisco_catalyst.LOGIN_PATHS,
        )
        counts = cisco_catalyst.Adapter({"username_env": "T_USER", "password_env": "T_PASS"}, client).get_client_counts()
        # radio0+radio1+radio2 = 42 (Ghz24/Ghz50 are the same clients, not added again); fallback to bands = 10.
        self.assertEqual(counts, {"SSC-AP01": 42, "SSC-AP02": 10})
        self.assertIn("deviceRole=AP", client.calls[1][2])
        self.assert_only_gets(client, cisco_catalyst.LOGIN_PATHS)

    def test_csv_file(self):
        counts = csv_file.Adapter({"path": str(ROOT / "sample_counts.csv")}).get_client_counts()
        self.assertEqual(counts["WEL-1-AP01"], 120)
        self.assertEqual(len(counts), 25)

    def test_csv_file_rejects_bad_rows(self):
        path = write(Path(tempfile.mkdtemp()) / "c.csv", "ap_name,count\nA,lots\n")
        with self.assertRaisesRegex(ValueError, "line 2"):
            csv_file.Adapter({"path": str(path)}).get_client_counts()


class ReadOnlyGuardTest(unittest.TestCase):
    def test_refuses_anything_but_get(self):
        client = FakeController({})
        for method in ["POST", "PUT", "PATCH", "DELETE"]:
            with self.assertRaises(ReadOnlyViolation):
                client._request(method, "/anything", None)
        self.assertEqual(client.calls, [])  # refused before any network call

    def test_post_only_to_allow_listed_login_path(self):
        client = FakeController({}, login_paths=("/oauth2/token",))
        with self.assertRaises(ReadOnlyViolation):
            client.login("/monitoring/v2/aps")
        with self.assertRaises(ReadOnlyViolation):
            client._request("PUT", "/oauth2/token", None)

    def test_refuses_other_hosts(self):
        client = FakeController({})
        with self.assertRaises(ReadOnlyViolation):
            client.get("https://evil.example.com/steal")
        with self.assertRaises(ReadOnlyViolation):
            client.get("https://controller.test.evil.com/x")


if __name__ == "__main__":
    unittest.main()
