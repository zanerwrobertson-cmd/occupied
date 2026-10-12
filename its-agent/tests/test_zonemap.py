import tempfile
import unittest
from pathlib import Path

from occupied_agent.zonemap import is_residence, load_zone_map, zone_id

from helpers import ROOT, make_config, write

HEADER = "ap_name,building,floor,subarea,exclude\n"


class ZoneIdTest(unittest.TestCase):
    def test_matches_the_app_and_simulator_format(self):
        self.assertEqual(zone_id("weldon", floor="1"), "weldon-f1")
        self.assertEqual(zone_id("weldon", floor="B1"), "weldon-fb1")
        self.assertEqual(zone_id("ucc", subarea="spoke"), "ucc-spoke")
        self.assertEqual(zone_id("ucc", subarea="Food-Court"), "ucc-food-court")
        self.assertEqual(zone_id("ssc"), "ssc-main")


class ResidenceTest(unittest.TestCase):
    def test_by_list_and_by_keyword(self):
        cfg = make_config()
        self.assertTrue(is_residence("delaware-hall", cfg))
        self.assertTrue(is_residence("new-residence", cfg))
        self.assertFalse(is_residence("weldon", cfg))


class LoadZoneMapTest(unittest.TestCase):
    def setUp(self):
        self.cfg = make_config()
        self.tmp = Path(tempfile.mkdtemp())

    def load(self, rows: str):
        return load_zone_map(write(self.tmp / "zones.csv", HEADER + rows), self.cfg)

    def test_example_file_is_valid(self):
        rows, problems = load_zone_map(ROOT / "zones.example.csv", make_config(allowed_buildings=frozenset(
            {"weldon", "taylor", "rec", "ucc", "ssc"})))
        self.assertEqual(problems, [])
        self.assertEqual(rows["WEL-1-AP01"].zone, "weldon-f1")
        self.assertEqual(rows["UCC-FOOD-AP02"].zone, "ucc-food-court")

    def test_exclude_column_and_residences_are_excluded(self):
        rows, problems = self.load("A,weldon,1,,yes\nB,delaware-hall,,,no\nC,some-residence,2,,\n")
        self.assertEqual(problems, [])
        self.assertTrue(all(r.zone is None for r in rows.values()))

    def test_problems_are_reported_by_line_number_never_ap_name(self):
        rows, problems = self.load(
            "SECRET-AP-1,weldon,1,,no\n"
            "SECRET-AP-1,weldon,2,,no\n"  # duplicate
            "SECRET-AP-2,unknown,1,,no\n"  # building not allowed
            "SECRET-AP-3,ucc,1,spoke,no\n"  # both floor and subarea
            "SECRET-AP-4,ucc,,Food Court,no\n"  # bad subarea
            "SECRET-AP-5,weldon,1,,maybe\n"  # bad exclude
            ",weldon,1,,no\n"  # empty name
        )
        self.assertEqual(len(problems), 6)
        self.assertTrue(all("line" in p for p in problems))
        self.assertFalse(any("SECRET" in p for p in problems))

    def test_wrong_header(self):
        path = write(self.tmp / "bad.csv", "name,building\nA,weldon\n")
        _, problems = load_zone_map(path, self.cfg)
        self.assertIn("header", problems[0])

    def test_missing_file(self):
        _, problems = load_zone_map(self.tmp / "nope.csv", self.cfg)
        self.assertIn("not found", problems[0])


if __name__ == "__main__":
    unittest.main()
