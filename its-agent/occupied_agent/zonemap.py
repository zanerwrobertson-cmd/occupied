"""Reads zones.csv: which access point belongs to which building, floor or area.

One row per AP:  ap_name, building, floor, subarea, exclude

Zone ids are built the same way as the app and simulator:
    building + floor    → "weldon-f1"
    building + subarea  → "ucc-spoke"
    building only       → "ssc-main"   (one zone for the whole building)

An AP is left out (never counted) if its row says exclude=yes, if its building is a residence,
or if it isn't in the file at all.
"""
import csv
import re
from dataclasses import dataclass
from pathlib import Path

from .config import Config

SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
TRUE = {"yes", "y", "true", "1", "x"}
FALSE = {"", "no", "n", "false", "0"}
COLUMNS = ["ap_name", "building", "floor", "subarea", "exclude"]


@dataclass(frozen=True)
class ZoneRow:
    zone: str | None  # None when the AP is excluded
    building: str


def zone_id(building: str, floor: str = "", subarea: str = "") -> str:
    if floor:
        return f"{building}-f{floor.lower()}"
    if subarea:
        return f"{building}-{subarea.lower()}"
    return f"{building}-main"


def is_residence(building: str, cfg: Config) -> bool:
    """Residences are always excluded: by name in the config, or anything with "resid" in its id."""
    return building in cfg.residence_buildings or "resid" in building


def load_zone_map(path: Path, cfg: Config) -> tuple[dict[str, ZoneRow], list[str]]:
    """Returns (ap_name → ZoneRow, problems). Problems refer to line numbers, never AP names,
    so they're safe to show in logs."""
    rows: dict[str, ZoneRow] = {}
    problems: list[str] = []
    if not path.is_file():
        return rows, [f"Zone map not found: {path}"]

    with path.open(newline="", encoding="utf-8-sig") as f:  # utf-8-sig copes with Excel's BOM
        reader = csv.DictReader(f)
        if reader.fieldnames is None or [c.strip() for c in reader.fieldnames] != COLUMNS:
            return rows, [f"{path.name}: header must be exactly: {','.join(COLUMNS)}"]
        for line, r in enumerate(reader, start=2):  # line 1 is the header
            ap = (r["ap_name"] or "").strip()
            building = (r["building"] or "").strip().lower()
            floor = (r["floor"] or "").strip()
            subarea = (r["subarea"] or "").strip().lower()
            exclude = (r["exclude"] or "").strip().lower()
            where = f"{path.name} line {line}"

            if not ap:
                problems.append(f"{where}: ap_name is empty")
                continue
            if ap in rows:
                problems.append(f"{where}: this ap_name already appears on an earlier line")
                continue
            if exclude not in TRUE | FALSE:
                problems.append(f"{where}: exclude must be yes or no")
                continue

            if exclude in TRUE or (building and is_residence(building, cfg)):
                rows[ap] = ZoneRow(zone=None, building=building)
                continue

            if building not in cfg.allowed_buildings:
                problems.append(f"{where}: building {building!r} is not in allowed_buildings")
            elif floor and subarea:
                problems.append(f"{where}: fill in floor or subarea, not both")
            elif floor and not re.fullmatch(r"[A-Za-z0-9]+", floor):
                problems.append(f"{where}: floor must be letters/digits only, e.g. 1 or B1")
            elif subarea and not SLUG.match(subarea):
                problems.append(f"{where}: subarea must be lowercase words joined by hyphens, e.g. food-court")
            else:
                rows[ap] = ZoneRow(zone=zone_id(building, floor, subarea), building=building)
    return rows, problems
