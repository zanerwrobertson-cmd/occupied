# Occupied ITS agent

A small program that would run on a Western ITS server. Every 15 minutes it asks the campus Wi-Fi
system **how many devices are connected near each access point**, adds those numbers up **per
building floor or area**, and sends only those totals to the Occupied app's server. Students then
see whether Weldon or the UCC is busy right now.

## What it does

1. **Reads** the number of connected devices per access point from the Wi-Fi controller
   (Cisco Catalyst Center, Cisco Meraki, Aruba Central or Juniper Mist), using a **read-only** account.
2. **Groups** access points into zones using a spreadsheet ITS fills in (`zones.csv`), for
   example "Weldon Library, floor 1". Access points not in the spreadsheet are ignored.
3. **Drops** every access point in a **residence**, plus any marked "exclude".
4. **Hides small numbers.** Any zone with fewer than 10 devices is sent as "<10", not an exact count.
5. **Checks** the result one last time. If it finds anything that looks like a device address
   (MAC), an IP address, an access point name, or a residence, it **sends nothing**.
6. **Sends** one small message, then exits. It looks like this:
   ```json
   { "timestamp": "2026-10-12T18:15:00Z",
     "zones": [ { "zone": "weldon-f1", "devices": 212 }, { "zone": "ucc-spoke", "devices": "<10" } ] }
   ```

## What it does not do

- **It never changes anything** on the Wi-Fi system. It only reads. The code refuses to send any
  request that isn't a read, apart from the sign-in step some vendors require (see SETUP.md).
- **It never looks at individual people or devices.** It never sends or stores MAC addresses,
  IP addresses, usernames, device types or locations of individuals.
- **It never sends access point names**, only zone names such as `weldon-f1`.
- **It never sends anything about residences.**
- **It never keeps data.** Nothing is written to disk except an Aruba sign-in token, and only
  when Aruba is the vendor. If sending fails, that run is simply skipped.
- **It doesn't run all the time.** Each run takes a few seconds and then exits. The server's
  normal scheduler (cron, systemd or Task Scheduler) starts it every 15 minutes.

## Why it's safe to run

- **Small and readable:** about 850 lines of Python (a good share of it comments), using only Python's standard library, with
  nothing to download or install from third parties.
- **Read-only access:** the controller account only needs read permission.
- **One outbound connection:** HTTPS to the Occupied server. No inbound connections.
- **Easy to stop:** removing it takes under 5 minutes ([ROLLBACK.md](ROLLBACK.md)).

## Documents in this folder

| File | For |
|---|---|
| [SETUP.md](SETUP.md) | Installing, configuring, scheduling, firewall rule |
| [PRIVACY.md](PRIVACY.md) | Exactly what data leaves the network and what never does |
| [ROLLBACK.md](ROLLBACK.md) | Stopping and removing it |
| [QUESTIONS_FOR_ITS.md](QUESTIONS_FOR_ITS.md) | What we need from ITS to finish |

## Status

The pipeline is **tested end to end with sample data**: this agent feeding the Occupied backend,
which works out busy levels correctly. The vendor connectors are written from each vendor's
public API documentation but are **untested against a real controller**. Each one is about
50 lines, so adjusting it once we can test against Western's system should be quick.

## For developers

```
agent.py                  entry point: python agent.py --once | --dry-run | --test-connection | --validate-config
occupied_agent/
  cli.py                  the run: fetch → map → aggregate → threshold → validate → send
  config.py               reads config.toml (secrets come from environment variables)
  zonemap.py              reads zones.csv; builds zone ids; residence rule
  pipeline.py             aggregation, payload and the privacy validation
  net.py                  all network access; the read-only guard; retries
  adapters/               one file per vendor: get_client_counts() -> {ap_name: count}
tests/                    python -m unittest discover -s tests
```

Requires Python 3.11 or newer. There are no other dependencies.
