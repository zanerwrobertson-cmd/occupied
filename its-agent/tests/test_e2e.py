"""End to end: csv_file adapter → agent → the real Occupied backend → GET /occupancy.

Proves the agent can replace the simulator with no backend changes. Needs a running backend,
ideally a fresh one so old data doesn't interfere:

    # from the repo root, in another terminal (any empty DB path works)
    PORT=4100 DB_PATH=/tmp/e2e.db INGEST_KEY=e2e-key npm run server

    # then, from its-agent/
    OCCUPIED_E2E_URL=http://127.0.0.1:4100 OCCUPIED_E2E_KEY=e2e-key python -m unittest discover -s tests -p test_e2e.py

Skipped automatically when OCCUPIED_E2E_URL isn't set.
"""
import json
import os
import unittest
import urllib.request
from datetime import datetime, timedelta, timezone

from occupied_agent import net
from occupied_agent.adapters import csv_file
from occupied_agent.cli import OK, run

from helpers import ROOT, make_config

URL = os.environ.get("OCCUPIED_E2E_URL", "").rstrip("/")
ALL_BUILDINGS = frozenset({
    "weldon", "taylor", "rec", "ucc", "ssc", "nsc", "pab", "mc", "uc", "tc", "th", "ivey",
    "ahb", "fims", "hsb", "msb", "bgs", "chem", "seb", "teb", "aceb", "stevenson", "ncb",
})


class HistoryAdapter:
    """Ten days of believable history built from sample_counts.csv: each AP follows a daily curve
    peaking in the evening. Taylor's history is 8× busier than today's sample, so today's reading
    should come out Quiet there, while Weldon's sample is at its usual peak (Very Busy)."""

    def __init__(self, base: dict[str, int], hour: int):
        self.base, self.hour = base, hour

    def get_client_counts(self):
        share = {8: 0.2, 10: 0.4, 12: 0.55, 14: 0.6, 16: 0.65, 18: 0.75, 20: 1.0, 22: 0.7}[self.hour]
        boost = lambda ap: 8 if ap.startswith("TAY") else 1  # noqa: E731
        return {ap: round(n * share * boost(ap)) for ap, n in self.base.items()}


@unittest.skipUnless(URL, "set OCCUPIED_E2E_URL (and OCCUPIED_E2E_KEY) to run against a live backend")
class EndToEndTest(unittest.TestCase):
    def test_agent_feeds_the_backend(self):
        os.environ["E2E_INGEST_KEY"] = os.environ.get("OCCUPIED_E2E_KEY", "")
        cfg = make_config(push_url=f"{URL}/ingest", ingest_key_env="E2E_INGEST_KEY", allowed_buildings=ALL_BUILDINGS)
        sample = csv_file.Adapter({"path": str(ROOT / "sample_counts.csv")})
        base = sample.get_client_counts()

        sent: list[dict] = []

        def recording_push(url, key, payload, timeout):
            sent.append(payload)
            return net.push(url, key, payload, timeout)

        # 1. History: 10 days × 8 readings a day, posted by the agent itself.
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        today_local = now.astimezone().replace(minute=0)
        for days_ago in range(10, 0, -1):
            for hour in (8, 10, 12, 14, 16, 18, 20, 22):
                at = (today_local - timedelta(days=days_ago)).replace(hour=hour)
                self.assertEqual(run(cfg, HistoryAdapter(base, hour), now=at, sender=recording_push), OK)

        # 2. Today's reading, through the real csv_file adapter, exactly as --once would do it.
        self.assertEqual(run(cfg, sample, now=now, sender=recording_push), OK)

        # Nothing identifying or residential was ever sent.
        for payload in sent:
            for z in payload["zones"]:
                self.assertFalse(z["zone"].startswith(("delaware", "saugeen")))
                self.assertNotIn("AP", z["zone"])

        # 3. What the app would see.
        with urllib.request.urlopen(f"{URL}/occupancy", timeout=10) as r:
            snap = json.load(r)
        self.assertEqual(snap["updatedAt"], int(now.timestamp() * 1000))
        b = {x["id"]: x for x in snap["buildings"]}

        self.assertEqual(b["weldon"]["status"], "live")
        self.assertEqual(b["weldon"]["level"], 3)  # at its usual evening peak → Very Busy
        self.assertEqual([f.get("status", "live") for f in b["weldon"]["floors"]], ["live"] * 5)
        self.assertEqual(b["taylor"]["level"], 0)  # far below its history → Quiet
        self.assertEqual(next(f for f in b["taylor"]["floors"] if f["name"] == "Floor 4")["status"], "low")  # 3 devices → "<10"
        pool = next(a for a in b["rec"]["areas"] if a["name"] == "Pool")
        self.assertEqual(pool["status"], "low")
        self.assertEqual(b["nsc"]["status"], "nodata")  # no APs mapped there in the example zone map
        self.assertEqual(len(b["weldon"]["typicalDay"]), 17)


if __name__ == "__main__":
    unittest.main()
