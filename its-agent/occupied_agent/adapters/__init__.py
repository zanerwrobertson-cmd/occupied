"""Vendor adapters. Each one answers a single question:

    get_client_counts() -> {ap_name: number_of_connected_clients}

Everything after that (mapping APs to zones, thresholds, privacy checks, sending) is the same
for every vendor. Supporting a new vendor means writing one small file here.
"""
from typing import Protocol

from ..config import Config
from ..net import ControllerClient
from . import aruba_central, cisco_catalyst, cisco_meraki, csv_file, juniper_mist


class Adapter(Protocol):
    def get_client_counts(self) -> dict[str, int]: ...


MODULES = {
    "cisco_catalyst": cisco_catalyst,
    "cisco_meraki": cisco_meraki,
    "aruba_central": aruba_central,
    "juniper_mist": juniper_mist,
    "csv_file": csv_file,
}


def make_adapter(cfg: Config) -> Adapter:
    module = MODULES[cfg.vendor]
    if cfg.vendor == "csv_file":
        return module.Adapter(cfg.controller)
    client = ControllerClient(
        cfg.controller["base_url"],
        cfg.timeout_seconds,
        ca_file=cfg.controller.get("ca_file"),
        login_paths=getattr(module, "LOGIN_PATHS", ()),
    )
    return module.Adapter(cfg.controller, client)
