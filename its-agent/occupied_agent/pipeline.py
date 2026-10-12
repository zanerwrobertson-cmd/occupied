"""The core of the agent: AP counts in, anonymous zone payload out.

    {ap_name: clients}  →  aggregate()  →  {zone: total}  →  build_payload()  →  validate_payload()

Nothing here touches the network or the disk.
"""
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone

from .config import Config
from .zonemap import ZoneRow, is_residence

BELOW = "<10"  # the backend's token for "below the threshold"

# Things that must never appear in a payload.
MAC = re.compile(r"\b[0-9a-f]{2}([:-][0-9a-f]{2}){5}\b|\b[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}\b", re.I)
IPV4 = re.compile(r"\b\d{1,3}(\.\d{1,3}){3}\b")
IPV6 = re.compile(r"\b[0-9a-f]{1,4}(:[0-9a-f]{0,4}){2,7}\b", re.I)
ZONE_ID = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)+$")
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


@dataclass
class Aggregate:
    totals: dict[str, int]  # zone → total clients
    unmapped: int  # APs not in zones.csv (dropped)
    excluded: int  # APs marked exclude or in a residence (dropped)


def aggregate(counts: dict[str, int], zone_map: dict[str, ZoneRow]) -> Aggregate:
    totals: Counter[str] = Counter()
    unmapped = excluded = 0
    for ap, n in counts.items():
        row = zone_map.get(ap)
        if row is None:
            unmapped += 1
        elif row.zone is None:
            excluded += 1
        else:
            totals[row.zone] += max(0, int(n))
    return Aggregate(dict(totals), unmapped, excluded)


def build_payload(totals: dict[str, int], threshold: int, now: datetime | None = None) -> dict:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return {
        "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        # Sorted so payloads are easy to diff; counts under the threshold become "<10".
        "zones": [{"zone": z, "devices": n if n >= threshold else BELOW} for z, n in sorted(totals.items())],
    }


def validate_payload(payload: dict, cfg: Config, ap_names: set[str]) -> list[str]:
    """Last check before anything leaves the network. Any problem → the run is not sent."""
    problems: list[str] = []
    if set(payload) != {"timestamp", "zones"}:
        problems.append("payload must contain only timestamp and zones")
    if not ISO_UTC.match(str(payload.get("timestamp", ""))):
        problems.append("timestamp is not ISO 8601 UTC")

    for z in payload.get("zones", []):
        if set(z) != {"zone", "devices"}:
            problems.append("a zone entry has fields other than zone and devices")
            continue
        zone, devices = z["zone"], z["devices"]
        building = str(zone).split("-")[0]
        if not ZONE_ID.match(str(zone)):
            problems.append("a zone id is not in building-floor/building-subarea form")
        if is_residence(building, cfg) or building not in cfg.allowed_buildings:
            problems.append("a zone belongs to a residence or an unknown building")
        if devices != BELOW and not (isinstance(devices, int) and devices >= cfg.threshold):
            problems.append(f"a count under the threshold was not sent as {BELOW}")

    # Scan the whole serialised payload for anything identifying.
    text = json.dumps(payload)
    if MAC.search(text):
        problems.append("payload contains something that looks like a MAC address")
    if IPV4.search(text) or IPV6.search(text.replace(payload.get("timestamp", ""), "")):
        problems.append("payload contains something that looks like an IP address")
    # AP names: a value equal to an AP name, or containing one. Short names (under 6 characters)
    # are only checked for an exact match, since e.g. "1" or "main" appear inside normal values.
    values = [payload.get("timestamp", "")] + [str(z.get("zone", "")) for z in payload.get("zones", [])]
    lowered = [v.lower() for v in values]
    for name in ap_names:
        n = name.lower()
        if any(v == n or (len(n) >= 6 and n in v) for v in lowered):
            problems.append("payload contains an AP name")
            break
    return sorted(set(problems))
