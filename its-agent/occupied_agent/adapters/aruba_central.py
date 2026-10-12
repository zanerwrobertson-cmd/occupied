"""Aruba Central adapter (classic Central API Gateway).

UNTESTED against a real controller. Written from the public Aruba Central API docs
(developer.arubanetworks.com/central). Response shapes are mirrored in tests/fixtures/aruba_*.json.

Endpoints called:
    POST {base_url}/oauth2/token?client_id=…&client_secret=…&grant_type=refresh_token&refresh_token=…
        → access_token, refresh_token. LOGIN ONLY: the one non-GET request, allow-listed below.
    GET  {base_url}/monitoring/v2/aps?limit=1000&offset=N
        → aps[].name, aps[].client_count, total

Auth: "Authorization: Bearer <access token>". Access tokens last 2 hours, so the agent refreshes
one on every run. Aruba issues a new refresh token each time; it is saved to `token_file`
(readable only by the agent's account) so the next run can use it. That file holds a credential,
never client data. The first refresh token comes from the API Gateway page in Central.
base_url is the region's API gateway, e.g. https://apigw-prod2.central.arubanetworks.com
"""
import json
import os
from pathlib import Path

from ..config import secret
from ..net import ControllerClient

LOGIN_PATHS = ("/oauth2/token",)
PAGE = 1000


class Adapter:
    def __init__(self, settings: dict, client: ControllerClient):
        self.settings = settings
        self.client = client
        self.token_file = Path(settings["token_file"])

    def _refresh_token(self) -> str:
        """Latest refresh token: from token_file if a previous run saved one, else the env var."""
        if self.token_file.is_file():
            return json.loads(self.token_file.read_text())["refresh_token"]
        return secret(self.settings["refresh_token_env"])

    def _sign_in(self) -> None:
        s = self.settings
        r = self.client.login(
            "/oauth2/token",
            {
                "client_id": secret(s["client_id_env"]),
                "client_secret": secret(s["client_secret_env"]),
                "grant_type": "refresh_token",
                "refresh_token": self._refresh_token(),
            },
        )
        tokens = r.data
        self.client.headers["Authorization"] = "Bearer " + tokens["access_token"]
        # Save the new refresh token, readable only by this account (on Linux/macOS).
        self.token_file.write_text(json.dumps({"refresh_token": tokens["refresh_token"]}))
        os.chmod(self.token_file, 0o600)

    def get_client_counts(self) -> dict[str, int]:
        self._sign_in()
        counts: dict[str, int] = {}
        offset = 0
        while True:
            data = self.client.get("/monitoring/v2/aps", {"limit": PAGE, "offset": offset}).data
            aps = data.get("aps", [])
            for ap in aps:
                name = ap.get("name") or ap.get("serial")
                if name:
                    counts[name] = int(ap.get("client_count") or 0)
            offset += len(aps)
            if not aps or offset >= data.get("total", 0):
                break
        return counts
