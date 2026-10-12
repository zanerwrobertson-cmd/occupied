"""Tests for a whole run (cli.run) and the network push, with no real network."""
import io
import json
import os
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest import mock

from occupied_agent import net
from occupied_agent.adapters import csv_file
from occupied_agent.cli import BAD_CONFIG, FAILED, OK, main, run
from occupied_agent.net import RequestFailed

from helpers import ROOT, make_config

AP_NAMES = [line.split(",")[0] for line in (ROOT / "sample_counts.csv").read_text().splitlines()[1:]]


@mock.patch.dict(os.environ, {"TEST_INGEST_KEY": "SECRET-INGEST-KEY"})
class RunTest(unittest.TestCase):
    def setUp(self):
        self.cfg = make_config()
        self.adapter = csv_file.Adapter(self.cfg.controller)

    def test_sends_validated_payload_and_logs_one_safe_line(self):
        sent = {}

        def fake_push(url, key, payload, timeout):
            sent.update(url=url, key=key, payload=payload)
            return 200

        with self.assertLogs("occupied-agent", "INFO") as logs:
            self.assertEqual(run(self.cfg, self.adapter, sender=fake_push), OK)

        zones = {z["zone"]: z["devices"] for z in sent["payload"]["zones"]}
        self.assertEqual(zones["weldon-f1"], 216)  # two Floor 1 APs added together
        self.assertEqual(zones["taylor-f4"], "<10")
        self.assertEqual(zones["rec-pool"], "<10")
        self.assertNotIn("delaware-hall-main", zones)  # residence
        self.assertEqual(sent["key"], "SECRET-INGEST-KEY")

        self.assertEqual(len(logs.output), 1)
        line = logs.output[0]
        self.assertIn("2 unmapped APs ignored", line)
        self.assertIn("3 excluded APs ignored", line)  # basement AP + 2 residence APs
        self.assertIn("HTTP 200", line)
        self.assertIn("zones sent", line)
        for name in AP_NAMES:
            self.assertNotIn(name, line)
        self.assertNotIn("SECRET-INGEST-KEY", line)

    def test_dry_run_prints_payload_and_sends_nothing(self):
        def must_not_send(*args):
            raise AssertionError("dry run sent something")

        out = io.StringIO()
        with redirect_stdout(out), self.assertLogs("occupied-agent", "INFO"):
            self.assertEqual(run(self.cfg, self.adapter, send=False, sender=must_not_send), OK)
        payload = json.loads(out.getvalue())
        self.assertEqual(set(payload), {"timestamp", "zones"})

    def test_failed_validation_sends_nothing(self):
        class LeakyAdapter:
            def get_client_counts(self):
                return {"WEL-1-AP01": 50}

        # A zone map where the "zone" is literally the AP name: validation must catch it.
        from occupied_agent.zonemap import ZoneRow

        with mock.patch("occupied_agent.cli.load_zone_map", return_value=({"WEL-1-AP01": ZoneRow("weldon-wel-1-ap01", "weldon")}, [])):
            with self.assertLogs("occupied-agent", "ERROR") as logs:
                result = run(self.cfg, LeakyAdapter(), sender=lambda *a: self.fail("sent"))
        self.assertEqual(result, FAILED)
        self.assertIn("validation failed", logs.output[0])
        self.assertNotIn("WEL-1-AP01", logs.output[0])

    def test_send_failure_skips_the_run(self):
        def failing(*args):
            raise RequestFailed("push → HTTP 503", 503)

        with self.assertLogs("occupied-agent", "ERROR") as logs:
            self.assertEqual(run(self.cfg, self.adapter, sender=failing), FAILED)
        self.assertIn("skipped until next run", logs.output[0])


class PushTest(unittest.TestCase):
    def test_retries_three_times_with_backoff_then_gives_up(self):
        waits = []
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("down")) as urlopen:
            with self.assertRaises(RequestFailed):
                net.push("http://localhost:1/ingest", "k", {"timestamp": "t", "zones": []}, 10, sleep=waits.append)
        self.assertEqual(urlopen.call_count, 4)  # first try + 3 retries
        self.assertEqual(waits, [2, 4, 8])

    def test_does_not_retry_a_bad_key(self):
        err = urllib.error.HTTPError("http://x", 401, "Unauthorized", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=err) as urlopen:
            with self.assertRaises(RequestFailed) as ctx:
                net.push("http://localhost:1/ingest", "bad", {}, 10, sleep=lambda s: None)
        self.assertEqual(ctx.exception.status, 401)
        self.assertEqual(urlopen.call_count, 1)

    def test_sends_key_header_and_timeout(self):
        class Resp:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        with mock.patch("urllib.request.urlopen", return_value=Resp()) as urlopen:
            self.assertEqual(net.push("http://localhost:1/ingest", "secret", {"a": 1}, 10), 200)
        req = urlopen.call_args.args[0]
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.get_header("X-ingest-key"), "secret")
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 10)


class CliTest(unittest.TestCase):
    def test_validate_config_on_the_example(self):
        out = io.StringIO()
        with redirect_stdout(out), mock.patch.dict(os.environ, {"OCCUPIED_INGEST_KEY": "k"}):
            code = main(["--config", str(ROOT / "config.example.toml"), "--validate-config"])
        self.assertEqual(code, OK, out.getvalue())
        self.assertIn("Config OK", out.getvalue())

    def test_bad_config_exit_code(self):
        with self.assertLogs("occupied-agent", "ERROR"):
            self.assertEqual(main(["--config", "does-not-exist.toml", "--once"]), BAD_CONFIG)

    def test_test_connection_prints_ap_count_only(self):
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(["--config", str(ROOT / "config.example.toml"), "--test-connection"])
        self.assertEqual(code, OK)
        self.assertEqual(out.getvalue().strip(), "Connected: the controller reported 25 APs")


if __name__ == "__main__":
    unittest.main()
