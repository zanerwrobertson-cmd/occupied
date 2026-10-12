"""CSV file adapter: reads AP client counts from a file instead of a controller.

For testing, and as a fallback if ITS would rather export a file on a schedule than give the
agent API access. Format (header required):

    ap_name,count
    WEL-1-AP01,34
    WEL-1-AP02,28
"""
import csv
from pathlib import Path


class Adapter:
    def __init__(self, settings: dict):
        self.path = Path(settings["path"])

    def get_client_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        with self.path.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames is None or [c.strip() for c in reader.fieldnames] != ["ap_name", "count"]:
                raise ValueError(f"{self.path.name}: header must be exactly: ap_name,count")
            for line, row in enumerate(reader, start=2):
                try:
                    n = int(row["count"])
                except (TypeError, ValueError):
                    raise ValueError(f"{self.path.name} line {line}: count must be a whole number")
                ap = row["ap_name"].strip()
                counts[ap] = counts.get(ap, 0) + n
        return counts
