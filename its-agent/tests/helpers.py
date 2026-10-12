"""Shared test helpers: a test config, and a fake controller that serves fixture files."""
import json
from pathlib import Path

from occupied_agent.config import Config
from occupied_agent.net import ControllerClient

HERE = Path(__file__).parent
ROOT = HERE.parent
FIXTURES = HERE / "fixtures"

ALLOWED = frozenset({"weldon", "taylor", "rec", "ucc", "ssc"})


def make_config(**overrides) -> Config:
    values = dict(
        vendor="csv_file",
        controller={"path": str(ROOT / "sample_counts.csv")},
        push_url="http://localhost:4000/ingest",
        ingest_key_env="TEST_INGEST_KEY",
        zone_map=ROOT / "zones.example.csv",
        threshold=10,
        timeout_seconds=10,
        interval_minutes=15,
        allowed_buildings=ALLOWED,
        residence_buildings=frozenset({"delaware-hall", "saugeen-maitland-hall"}),
    )
    values.update(overrides)
    return Config(**values)


def fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


class FakeController(ControllerClient):
    """A ControllerClient whose network call is replaced by a lookup table.

    routes: {(method, path): fixture_file or (fixture_file, headers)}. Every call is recorded in
    self.calls, so tests can check exactly which requests were made. The read-only guard in
    ControllerClient._request still runs, because only _send is replaced.
    """

    def __init__(self, routes: dict, login_paths=(), base_url="https://controller.test"):
        super().__init__(base_url, timeout=5, login_paths=login_paths)
        self.routes = routes
        self.calls: list[tuple[str, str, str]] = []  # (method, path, query)

    def _send(self, method, url, headers):
        from urllib.parse import urlsplit

        parts = urlsplit(url)
        self.calls.append((method, parts.path, parts.query))
        route = self.routes.get((method, parts.path))
        if route is None:
            raise AssertionError(f"unexpected request {method} {parts.path}")
        # A route can be a list of responses, used in order (for pagination).
        if isinstance(route, list):
            route = route.pop(0)
        name, resp_headers = route if isinstance(route, tuple) else (route, {})
        return 200, fixture(name), resp_headers


def write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


def as_json(data) -> bytes:
    return json.dumps(data).encode()
