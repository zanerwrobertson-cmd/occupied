"""Command line: python agent.py --once | --dry-run | --test-connection | --validate-config

A normal run (--once), which is what the scheduler calls every 15 minutes:
    fetch AP counts → map APs to zones → drop unmapped/excluded → total per zone
    → apply threshold → build payload → validate → POST → one log line
"""
import argparse
import json
import logging
import sys
from datetime import datetime

from .adapters import make_adapter
from .config import Config, ConfigError, load_config, missing_secrets, secret
from .net import ReadOnlyViolation, RequestFailed, push
from .pipeline import aggregate, build_payload, validate_payload
from .zonemap import load_zone_map

log = logging.getLogger("occupied-agent")

# Exit codes, so a scheduler or monitoring tool can tell what happened.
OK, FAILED, BAD_CONFIG = 0, 1, 2


def run(cfg: Config, adapter, send: bool = True, now: datetime | None = None, sender=push) -> int:
    zone_map, problems = load_zone_map(cfg.zone_map, cfg)
    if problems:
        log.error("zone map has %d problem(s); run --validate-config. Nothing sent.", len(problems))
        return BAD_CONFIG

    counts = adapter.get_client_counts()
    agg = aggregate(counts, zone_map)
    payload = build_payload(agg.totals, cfg.threshold, now)

    problems = validate_payload(payload, cfg, set(counts) | set(zone_map))
    if problems:
        log.error("validation failed, nothing sent: %s", "; ".join(problems))
        return FAILED

    zones = f"{len(payload['zones'])} zones"
    dropped = f"{agg.unmapped} unmapped APs ignored, {agg.excluded} excluded APs ignored"
    if not send:
        print(json.dumps(payload, indent=2))
        log.info("dry run: %s (not sent), %s", zones, dropped)
        return OK

    try:
        status = sender(cfg.push_url, secret(cfg.ingest_key_env), payload, cfg.timeout_seconds)
    except RequestFailed as e:
        log.error("run: %s NOT sent (%s), %s; skipped until next run", zones, e, dropped)
        return FAILED
    log.info("run: %s sent, %s, HTTP %s", zones, dropped, status)
    return OK


def validate_config(cfg: Config) -> int:
    zone_map, problems = load_zone_map(cfg.zone_map, cfg)
    for p in problems:
        print(f"  [x] {p}")
    for name in missing_secrets(cfg):
        print(f"  [x] environment variable {name} is not set")
    zones = sorted({r.zone for r in zone_map.values() if r.zone})
    excluded = sum(1 for r in zone_map.values() if r.zone is None)
    print(f"Vendor: {cfg.vendor}")
    print(f"Zone map: {len(zone_map)} APs -> {len(zones)} zones, {excluded} APs excluded")
    print(f"Push to: {cfg.push_url} every {cfg.interval_minutes} min, threshold {cfg.threshold}")
    ok = not problems and not missing_secrets(cfg)
    print("Config OK" if ok else "Config has problems (see [x] above)")
    return OK if ok else BAD_CONFIG


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Occupied ITS agent: anonymous Wi-Fi counts per campus zone.")
    parser.add_argument("--config", default="config.toml", help="path to config.toml (default: ./config.toml)")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--once", action="store_true", help="one run: fetch, aggregate, validate and send")
    mode.add_argument("--dry-run", action="store_true", help="fetch, aggregate and print the payload; send nothing")
    mode.add_argument("--test-connection", action="store_true", help="check controller credentials; print the AP count only")
    mode.add_argument("--validate-config", action="store_true", help="check config.toml and the zone map")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", stream=sys.stderr)
    try:
        cfg = load_config(args.config)
        if args.validate_config:
            return validate_config(cfg)
        adapter = make_adapter(cfg)
        if args.test_connection:
            print(f"Connected: the controller reported {len(adapter.get_client_counts())} APs")
            return OK
        return run(cfg, adapter, send=args.once)
    except ConfigError as e:
        for p in e.problems:
            log.error("config: %s", p)
        return BAD_CONFIG
    except (RequestFailed, ReadOnlyViolation) as e:
        log.error("controller: %s", e)
        return FAILED
    except Exception as e:  # last resort: one clear line, no stack trace full of data
        log.error("unexpected %s: %s", type(e).__name__, e)
        return FAILED
