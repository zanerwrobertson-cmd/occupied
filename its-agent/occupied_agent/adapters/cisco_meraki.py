"""Cisco Meraki adapter.

UNTESTED against a real controller. Written from the public Meraki Dashboard API v1 docs
(developer.cisco.com/meraki/api-v1). Response shapes are mirrored in tests/fixtures/meraki_*.json.

Endpoints called (all GET):
    GET {base_url}/organizations/{org_id}/devices?productTypes[]=wireless
        → AP name for each serial
    GET {base_url}/organizations/{org_id}/wireless/clients/overview/byDevice
        → items[].serial, items[].counts.byStatus.online  (clients per AP)

Auth: header "Authorization: Bearer <API key>" (a read-only Dashboard API key is enough).
Both endpoints are paginated with a Link header (rel=next).
base_url is normally https://api.meraki.com/api/v1
"""
import re

from ..config import secret
from ..net import ControllerClient

NEXT_LINK = re.compile(r'<([^>]+)>;\s*rel="?next"?')


class Adapter:
    def __init__(self, settings: dict, client: ControllerClient):
        self.org = settings["org_id"]
        self.client = client
        client.headers["Authorization"] = "Bearer " + secret(settings["api_key_env"])

    def _all_pages(self, path: str, params: dict) -> list:
        """Follow Link: <…>; rel=next headers until there are no more pages."""
        items: list = []
        url, query = path, params
        while url:
            r = self.client.get(url, query)
            page = r.data["items"] if isinstance(r.data, dict) else r.data
            items.extend(page or [])
            match = NEXT_LINK.search(r.headers.get("Link", ""))
            url, query = (match.group(1), None) if match else (None, None)
        return items

    def get_client_counts(self) -> dict[str, int]:
        devices = self._all_pages(f"/organizations/{self.org}/devices", {"productTypes[]": "wireless", "perPage": 1000})
        # APs without a name in Dashboard are identified by serial instead.
        names = {d["serial"]: d.get("name") or d["serial"] for d in devices}
        counts: dict[str, int] = {}
        for item in self._all_pages(f"/organizations/{self.org}/wireless/clients/overview/byDevice", {"perPage": 1000}):
            name = names.get(item["serial"], item["serial"])
            counts[name] = int(item.get("counts", {}).get("byStatus", {}).get("online", 0))
        return counts
