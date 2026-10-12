"""Cisco Catalyst Center (formerly DNA Center) adapter.

UNTESTED against a real controller. Written from the public Catalyst Center Intent API docs
(developer.cisco.com/docs/dna-center, 2.3.x). Response shapes are mirrored in
tests/fixtures/catalyst_*.json.

Endpoints called:
    POST {base_url}/dna/system/api/v1/auth/token   (HTTP Basic auth)
        → {"Token": "…"}. LOGIN ONLY: the one non-GET request, allow-listed below.
    GET  {base_url}/dna/intent/api/v1/device-health?deviceRole=AP&limit=500&offset=N
        → response[].name, response[].clientCount.{radio0..radio3}, totalCount

Auth: header "X-Auth-Token: <token>" (tokens last about an hour; a new one is fetched each run).
A user with the read-only OBSERVER role is enough. If the controller uses a certificate from an
internal CA, set ca_file in config.toml.
"""
from ..config import secret
from ..net import ControllerClient, basic_auth

LOGIN_PATHS = ("/dna/system/api/v1/auth/token",)
PAGE = 500  # the API's maximum


def ap_clients(device: dict) -> int:
    """clientCount is per radio. Add up radio0–radio3; Ghz24/Ghz50 are the same clients grouped
    by band, so they're only used if the radio fields are missing."""
    c = device.get("clientCount") or {}
    if isinstance(c, (int, float)):
        return int(c)
    radios = [v for k, v in c.items() if k.startswith("radio") and isinstance(v, (int, float))]
    if radios:
        return int(sum(radios))
    return int(c.get("Ghz24", 0) or 0) + int(c.get("Ghz50", 0) or 0)


class Adapter:
    def __init__(self, settings: dict, client: ControllerClient):
        self.settings = settings
        self.client = client

    def get_client_counts(self) -> dict[str, int]:
        s = self.settings
        r = self.client.login(
            "/dna/system/api/v1/auth/token",
            headers={"Authorization": basic_auth(secret(s["username_env"]), secret(s["password_env"]))},
        )
        self.client.headers["X-Auth-Token"] = r.data["Token"]

        counts: dict[str, int] = {}
        offset = 1  # this API's offsets start at 1
        while True:
            data = self.client.get(
                "/dna/intent/api/v1/device-health", {"deviceRole": "AP", "limit": PAGE, "offset": offset}
            ).data
            devices = data.get("response", [])
            for d in devices:
                if d.get("name"):
                    counts[d["name"]] = ap_clients(d)
            if len(devices) < PAGE:
                break
            offset += PAGE
        return counts
