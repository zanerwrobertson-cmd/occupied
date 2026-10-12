"""Juniper Mist adapter.

UNTESTED against a real controller. Written from the public Mist API docs
(api.mist.com/api/v1/docs). Response shapes are mirrored in tests/fixtures/mist_*.json.

Endpoints called (all GET):
    GET {base_url}/api/v1/orgs/{org_id}/sites
        → list of sites (id)
    GET {base_url}/api/v1/sites/{site_id}/stats/devices?type=ap&limit=1000&page=N
        → per AP: name, num_clients

Auth: header "Authorization: Token <API token>" (an Observer/read-only token is enough).
base_url depends on the Mist cloud region, e.g. https://api.mist.com or https://api.gc1.mist.com
"""
from ..config import secret
from ..net import ControllerClient

PAGE = 1000


class Adapter:
    def __init__(self, settings: dict, client: ControllerClient):
        self.org = settings["org_id"]
        self.client = client
        client.headers["Authorization"] = "Token " + secret(settings["api_token_env"])

    def get_client_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        sites = self.client.get(f"/api/v1/orgs/{self.org}/sites").data or []
        for site in sites:
            page = 1
            while True:
                aps = self.client.get(
                    f"/api/v1/sites/{site['id']}/stats/devices", {"type": "ap", "limit": PAGE, "page": page}
                ).data or []
                for ap in aps:
                    # Unnamed APs fall back to their serial; never their MAC.
                    name = ap.get("name") or ap.get("serial")
                    if name:
                        counts[name] = int(ap.get("num_clients") or 0)
                if len(aps) < PAGE:
                    break
                page += 1
        return counts
