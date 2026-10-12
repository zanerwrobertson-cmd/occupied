"""All network access, in one small file.

Two kinds of request, and nothing else:
  1. ControllerClient — reads from the Wi-Fi controller. GET only. The single exception is a POST
     to a vendor's login/token URL, which Catalyst Center and Aruba Central require to sign in;
     those URLs are allow-listed per adapter and nothing else can be POSTed. Requests may only go
     to the configured controller host.
  2. push() — sends the finished, validated payload to the Occupied backend.

Logs show the HTTP method, path and status only: never query strings (they can hold secrets),
headers, or response bodies (they hold AP names).
"""
import base64
import json
import logging
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

log = logging.getLogger("occupied-agent")

RETRIES = 3  # attempts after the first one
BACKOFF_SECONDS = (2, 4, 8)


class ReadOnlyViolation(RuntimeError):
    """Raised before sending if code tries anything other than a read (or an allow-listed login)."""


class RequestFailed(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass
class Response:
    data: object
    headers: dict[str, str]


def basic_auth(user: str, password: str) -> str:
    return "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()


class ControllerClient:
    def __init__(self, base_url: str, timeout: float, ca_file: str | None = None, login_paths: tuple[str, ...] = ()):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        # Verifies the controller's HTTPS certificate. ca_file lets ITS trust an internal CA.
        self.tls = ssl.create_default_context(cafile=ca_file or None)
        self.login_paths = frozenset(login_paths)
        self.headers: dict[str, str] = {"Accept": "application/json"}

    def get(self, path_or_url: str, params: dict | None = None) -> Response:
        return self._request("GET", path_or_url, params)

    def login(self, path: str, params: dict | None = None, headers: dict | None = None) -> Response:
        """POST to an allow-listed sign-in URL. Used only to obtain a session token."""
        return self._request("POST", path, params, headers)

    def _request(self, method: str, path_or_url: str, params: dict | None, extra: dict | None = None) -> Response:
        url = path_or_url if path_or_url.startswith("https://") else self.base_url + path_or_url
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params, doseq=True)
        path = urllib.parse.urlsplit(url).path

        # --- The read-only guard ---
        if method != "GET" and not (method == "POST" and path in self.login_paths):
            raise ReadOnlyViolation(f"refused {method} {path}: the agent only reads from the controller")
        if not url.startswith(self.base_url + "/"):
            raise ReadOnlyViolation(f"refused request to a host other than the configured controller ({path})")

        headers = {**self.headers, **(extra or {})}
        status, body, resp_headers = self._with_retries(method, url, headers)
        try:
            data = json.loads(body) if body else None
        except json.JSONDecodeError:
            raise RequestFailed(f"{method} {path}: response was not JSON", status)
        return Response(data, resp_headers)

    def _with_retries(self, method: str, url: str, headers: dict) -> tuple[int, bytes, dict]:
        path = urllib.parse.urlsplit(url).path
        for attempt in range(RETRIES + 1):
            try:
                return self._send(method, url, headers)
            except urllib.error.HTTPError as e:
                # 429 (rate limited) and 5xx are worth retrying; other errors (401, 404…) are not.
                if (e.code != 429 and e.code < 500) or attempt == RETRIES:
                    raise RequestFailed(f"{method} {path} → HTTP {e.code}", e.code)
                wait = int(e.headers.get("Retry-After", BACKOFF_SECONDS[attempt]))
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if attempt == RETRIES:
                    raise RequestFailed(f"{method} {path} → {type(e).__name__}")
                wait = BACKOFF_SECONDS[attempt]
            log.debug("retrying %s %s in %ss", method, path, wait)
            time.sleep(wait)
        raise AssertionError("unreachable")

    def _send(self, method: str, url: str, headers: dict) -> tuple[int, bytes, dict]:
        """The only line that actually opens a connection to the controller. Tests replace it."""
        req = urllib.request.Request(url, method=method, headers=headers, data=b"" if method == "POST" else None)
        with urllib.request.urlopen(req, timeout=self.timeout, context=self.tls) as r:
            return r.status, r.read(), dict(r.headers)


def push(url: str, key: str, payload: dict, timeout: float, sleep=time.sleep) -> int:
    """POST the payload to the Occupied backend with up to 3 retries. Returns the HTTP status.
    Raises RequestFailed if it never succeeds. Nothing is written to disk if it fails."""
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "x-ingest-key": key}
    for attempt in range(RETRIES + 1):
        try:
            req = urllib.request.Request(url, data=body, method="POST", headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status
        except urllib.error.HTTPError as e:
            # 4xx means the request itself is wrong (bad key, bad payload): retrying won't help.
            if (e.code < 500 and e.code != 429) or attempt == RETRIES:
                raise RequestFailed(f"push → HTTP {e.code}", e.code)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt == RETRIES:
                raise RequestFailed(f"push → {type(e).__name__}")
        sleep(BACKOFF_SECONDS[attempt])
    raise AssertionError("unreachable")
