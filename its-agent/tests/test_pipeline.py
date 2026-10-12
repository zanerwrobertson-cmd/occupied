import json
import unittest
from datetime import datetime, timezone

from occupied_agent.pipeline import BELOW, aggregate, build_payload, validate_payload
from occupied_agent.zonemap import ZoneRow

from helpers import make_config

ZONE_MAP = {
    "WEL-1-A": ZoneRow("weldon-f1", "weldon"),
    "WEL-1-B": ZoneRow("weldon-f1", "weldon"),
    "UCC-SPOKE": ZoneRow("ucc-spoke", "ucc"),
    "TAY-4": ZoneRow("taylor-f4", "taylor"),
    "WEL-BASEMENT": ZoneRow(None, "weldon"),  # excluded
    "DEL-1": ZoneRow(None, "delaware-hall"),  # residence
}
NOW = datetime(2026, 10, 12, 18, 15, tzinfo=timezone.utc)


class AggregateTest(unittest.TestCase):
    def test_sums_aps_per_zone_and_counts_what_was_dropped(self):
        counts = {"WEL-1-A": 120, "WEL-1-B": 80, "UCC-SPOKE": 55, "TAY-4": 3, "WEL-BASEMENT": 40, "DEL-1": 200, "MYSTERY-1": 9, "MYSTERY-2": 1}
        agg = aggregate(counts, ZONE_MAP)
        self.assertEqual(agg.totals, {"weldon-f1": 200, "ucc-spoke": 55, "taylor-f4": 3})
        self.assertEqual(agg.unmapped, 2)
        self.assertEqual(agg.excluded, 2)

    def test_negative_counts_are_treated_as_zero(self):
        self.assertEqual(aggregate({"TAY-4": -5}, ZONE_MAP).totals, {"taylor-f4": 0})


class PayloadTest(unittest.TestCase):
    def test_exact_backend_format(self):
        payload = build_payload({"weldon-f1": 200, "taylor-f4": 3, "ucc-spoke": 10}, threshold=10, now=NOW)
        self.assertEqual(
            payload,
            {
                "timestamp": "2026-10-12T18:15:00Z",
                "zones": [
                    {"zone": "taylor-f4", "devices": BELOW},
                    {"zone": "ucc-spoke", "devices": 10},  # exactly the threshold is sent as a number
                    {"zone": "weldon-f1", "devices": 200},
                ],
            },
        )

    def test_higher_threshold_hides_more(self):
        payload = build_payload({"weldon-f1": 15}, threshold=20, now=NOW)
        self.assertEqual(payload["zones"][0]["devices"], BELOW)

    def test_converts_local_time_to_utc(self):
        local = datetime(2026, 10, 12, 14, 15).astimezone()
        self.assertTrue(build_payload({}, 10, local)["timestamp"].endswith("Z"))


class ValidateTest(unittest.TestCase):
    def setUp(self):
        self.cfg = make_config()
        self.good = build_payload({"weldon-f1": 200, "taylor-f4": 3}, 10, NOW)

    def check(self, payload, ap_names=frozenset({"WEL-1-A", "TAY-4"})):
        return validate_payload(payload, self.cfg, set(ap_names))

    def test_good_payload_passes(self):
        self.assertEqual(self.check(self.good), [])

    def mutate(self, **zone_fields):
        p = json.loads(json.dumps(self.good))
        p["zones"][0].update(zone_fields)
        return p

    def test_rejects_ap_names(self):
        self.assertIn("payload contains an AP name", self.check(self.mutate(zone="weldon-f1"), {"weldon-f1"}))
        long_name = {"WELDON-F1-NORTH"}
        p = self.mutate(zone="weldon-f1-north")
        self.assertIn("payload contains an AP name", self.check(p, long_name))

    def test_rejects_mac_and_ip_addresses(self):
        for zone in ["weldon-aa:bb:cc:dd:ee:ff", "weldon-0011.2233.4455"]:
            self.assertIn("payload contains something that looks like a MAC address", self.check(self.mutate(zone=zone)))
        self.assertIn("payload contains something that looks like an IP address", self.check(self.mutate(zone="weldon-10.0.0.1")))
        self.assertIn("payload contains something that looks like an IP address", self.check(self.mutate(zone="weldon-fe80::1")))

    def test_rejects_extra_fields(self):
        self.assertIn("a zone entry has fields other than zone and devices", self.check(self.mutate(mac="x")))
        p = dict(self.good, ap_count=3)
        self.assertIn("payload must contain only timestamp and zones", self.check(p))

    def test_rejects_residence_and_unknown_buildings(self):
        self.assertIn("a zone belongs to a residence or an unknown building", self.check(self.mutate(zone="delaware-hall-f1")))
        self.assertIn("a zone belongs to a residence or an unknown building", self.check(self.mutate(zone="mystery-main")))

    def test_rejects_small_exact_counts(self):
        self.assertIn("a count under the threshold was not sent as <10", self.check(self.mutate(devices=4)))

    def test_rejects_bad_timestamp(self):
        p = dict(self.good, timestamp="2026-10-12 18:15")
        self.assertIn("timestamp is not ISO 8601 UTC", self.check(p))


if __name__ == "__main__":
    unittest.main()
