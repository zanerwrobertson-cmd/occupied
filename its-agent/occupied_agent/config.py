"""Loads and checks config.toml.

The config file holds settings and the *names* of environment variables that contain secrets.
Secret values themselves are only ever read from the environment (see `secret()`), so the
config file can be reviewed, copied and version-controlled safely.
"""
import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

VENDORS = ("cisco_catalyst", "cisco_meraki", "aruba_central", "juniper_mist", "csv_file")

# Settings each vendor needs under [controller]. Keys ending in _env name an environment variable.
VENDOR_KEYS = {
    "cisco_catalyst": ("base_url", "username_env", "password_env"),
    "cisco_meraki": ("base_url", "api_key_env", "org_id"),
    "aruba_central": ("base_url", "client_id_env", "client_secret_env", "refresh_token_env", "token_file"),
    "juniper_mist": ("base_url", "api_token_env", "org_id"),
    "csv_file": ("path",),
}


class ConfigError(Exception):
    """Raised with a list of every problem found, so they can all be fixed in one go."""

    def __init__(self, problems: list[str]):
        super().__init__("\n".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class Config:
    vendor: str
    controller: dict
    push_url: str
    ingest_key_env: str
    zone_map: Path
    threshold: int = 10
    timeout_seconds: float = 10
    interval_minutes: int = 15
    allowed_buildings: frozenset[str] = field(default_factory=frozenset)
    residence_buildings: frozenset[str] = field(default_factory=frozenset)


def load_config(path: str | Path) -> Config:
    path = Path(path)
    if not path.is_file():
        raise ConfigError([f"Config file not found: {path}"])
    with path.open("rb") as f:
        try:
            raw = tomllib.load(f)
        except tomllib.TOMLDecodeError as e:
            raise ConfigError([f"{path} is not valid TOML: {e}"])

    problems: list[str] = []
    vendor = raw.get("vendor")
    if vendor not in VENDORS:
        problems.append(f"vendor must be one of {', '.join(VENDORS)} (got {vendor!r})")

    controller = raw.get("controller", {})
    for key in VENDOR_KEYS.get(vendor, ()):
        if not controller.get(key):
            problems.append(f"[controller] {key} is required for vendor {vendor}")
    base_url = controller.get("base_url", "")
    if base_url and not base_url.startswith("https://"):
        problems.append("[controller] base_url must start with https://")

    push = raw.get("push", {})
    push_url = push.get("url", "")
    # Plain http is only allowed to this machine, for local testing.
    if not (push_url.startswith("https://") or push_url.startswith(("http://localhost", "http://127.0.0.1"))):
        problems.append("[push] url must start with https:// (http:// is only allowed for localhost)")
    if not push.get("ingest_key_env"):
        problems.append("[push] ingest_key_env is required")

    threshold = raw.get("threshold", 10)
    # The backend only accepts exact counts of 10 or more, so the threshold can't go lower.
    if not isinstance(threshold, int) or threshold < 10:
        problems.append("threshold must be a whole number of at least 10")
    timeout = raw.get("timeout_seconds", 10)
    if not isinstance(timeout, (int, float)) or not 1 <= timeout <= 60:
        problems.append("timeout_seconds must be between 1 and 60")
    interval = raw.get("interval_minutes", 15)
    if not isinstance(interval, int) or not 5 <= interval <= 60:
        problems.append("interval_minutes must be between 5 and 60")

    allowed = frozenset(raw.get("allowed_buildings", []))
    if not allowed:
        problems.append("allowed_buildings must list the building ids the app knows about")
    residences = frozenset(raw.get("residence_buildings", []))
    if allowed & residences:
        problems.append(f"buildings listed as both allowed and residence: {', '.join(sorted(allowed & residences))}")

    # Relative paths in the config are relative to the config file, not wherever it's run from.
    here = path.parent
    zone_map = here / raw.get("zone_map", "zones.csv")
    if vendor == "csv_file" and controller.get("path"):
        controller = {**controller, "path": str(here / controller["path"])}
    if vendor == "aruba_central" and controller.get("token_file"):
        controller = {**controller, "token_file": str(here / controller["token_file"])}

    if problems:
        raise ConfigError(problems)
    return Config(
        vendor=vendor,
        controller=controller,
        push_url=push_url,
        ingest_key_env=push["ingest_key_env"],
        zone_map=zone_map,
        threshold=threshold,
        timeout_seconds=timeout,
        interval_minutes=interval,
        allowed_buildings=allowed,
        residence_buildings=residences,
    )


def secret(env_name: str) -> str:
    """Read a secret from the environment. The error names the variable, never the value."""
    value = os.environ.get(env_name, "")
    if not value:
        raise ConfigError([f"Environment variable {env_name} is not set"])
    return value


def missing_secrets(cfg: Config) -> list[str]:
    """Names of required secret environment variables that aren't set."""
    names = [cfg.ingest_key_env] + [v for k, v in cfg.controller.items() if k.endswith("_env")]
    return [n for n in names if not os.environ.get(n)]
