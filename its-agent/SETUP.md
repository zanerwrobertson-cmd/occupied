# Setup

Expect about 30 minutes once the API account and zone spreadsheet are ready.

## 1. Requirements

- Any Linux, macOS or Windows server that can reach the Wi-Fi controller's API.
- **Python 3.11 or newer** (`python3 --version`). Nothing else to install: there is no pip and
  no third-party packages.
- **One outbound firewall rule** (step 7). No inbound ports are needed.

## 2. Install

Copy the `its-agent` folder to the server, for example to `/opt/occupied-agent` (Linux) or
`C:\occupied-agent` (Windows). Then create a dedicated, unprivileged service account to run it:

```bash
sudo useradd --system --home /opt/occupied-agent --shell /usr/sbin/nologin occupied
sudo chown -R occupied: /opt/occupied-agent
```

## 3. A read-only API account on the controller

| Vendor | What to create | Permission |
|---|---|---|
| Cisco Catalyst Center | A local user | **OBSERVER** role (read-only) |
| Cisco Meraki | A Dashboard API key for an org admin | **Read-only** organization access |
| Aruba Central | An API client in *Organization → Platform Integration → REST API*, then generate a token | **Read-only** / Monitoring role |
| Juniper Mist | An API token | **Observer** role |

**A note on "read-only" for Cisco Catalyst Center and Aruba Central.** These two require a
**sign-in POST** to get a session token: `/dna/system/api/v1/auth/token` for Catalyst Center and
`/oauth2/token` for Aruba. That's the only non-GET request the agent can make. The code refuses
every other method, any other path, and any other host (see `occupied_agent/net.py`). Meraki and
Mist use GET only.

## 4. Configure

```bash
cp config.example.toml config.toml
cp zones.example.csv zones.csv
```

**`config.toml`:** set `vendor`, the `[controller]` section for your vendor (the example lists
every option), and `zone_map = "zones.csv"`. Secrets **never** go in this file. It only contains
the names of environment variables.

**`zones.csv`:** one row per access point:

| Column | Example | Meaning |
|---|---|---|
| `ap_name` | `WEL-1-AP01` | Exactly as the controller names it (Meraki/Mist: the serial if unnamed) |
| `building` | `weldon` | An id from `allowed_buildings` in config.toml |
| `floor` | `1` | Fill in **either** floor… |
| `subarea` | `food-court` | …**or** sub-area, or neither for "whole building" |
| `exclude` | `yes` / `no` | `yes` = never count this AP (e.g. staff-only areas) |

APs in residences are excluded automatically. APs missing from the file are ignored.

**Secrets** go in environment variables named in config.toml. On Linux with systemd, put them in
`/etc/occupied-agent.env`, owned by root, mode `600`:

```bash
OCCUPIED_INGEST_KEY=…           # from the Occupied team
OCCUPIED_CATALYST_USER=…        # whichever your vendor needs
OCCUPIED_CATALYST_PASSWORD=…
```

On Windows, set them as system environment variables for the service account, or in the
scheduled task's environment.

## 5. Check everything before sending anything

```bash
python3 agent.py --validate-config     # checks config.toml, zones.csv and that secrets are set
python3 agent.py --test-connection     # signs in and prints only how many APs it can see
python3 agent.py --dry-run             # shows exactly what would be sent; sends nothing
```

Review the `--dry-run` output. It should contain only zone ids like `weldon-f1` and counts.

## 6. Schedule it (every 15 minutes)

Each run sends once and exits. Pick whichever scheduler the server already uses.

**Linux, systemd timer (recommended).** `/etc/systemd/system/occupied-agent.service`:

```ini
[Unit]
Description=Occupied ITS agent (one run)

[Service]
Type=oneshot
User=occupied
WorkingDirectory=/opt/occupied-agent
EnvironmentFile=/etc/occupied-agent.env
ExecStart=/usr/bin/python3 /opt/occupied-agent/agent.py --once
# Hardening: no writes outside its own folder, no new privileges.
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/opt/occupied-agent
```

`/etc/systemd/system/occupied-agent.timer`:

```ini
[Unit]
Description=Run the Occupied ITS agent every 15 minutes

[Timer]
OnCalendar=*:0/15
Persistent=false

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now occupied-agent.timer
journalctl -u occupied-agent      # one log line per run
```

**Linux/macOS, cron.** Run `crontab -e` as the `occupied` user:

```cron
*/15 * * * * cd /opt/occupied-agent && set -a && . /etc/occupied-agent.env && /usr/bin/python3 agent.py --once >> agent.log 2>&1
```

**Windows, Task Scheduler** (PowerShell as administrator):

```powershell
$action  = New-ScheduledTaskAction -Execute "py.exe" -Argument "agent.py --once" -WorkingDirectory "C:\occupied-agent"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "Occupied ITS agent" -Action $action -Trigger $trigger -User "DOMAIN\svc-occupied" -Password "…"
```

## 7. Firewall: one outbound rule

| Direction | From | To | Port | Why |
|---|---|---|---|---|
| Outbound | the agent server | the Occupied server's hostname (from the Occupied team) | TCP 443 (HTTPS) | Sending zone counts |

The agent also needs to reach the controller API. For an on-premises Catalyst Center that is
internal traffic. For Meraki, Aruba Central or Mist it's an outbound HTTPS connection to the
vendor cloud API, which ITS's own tools probably already use.

## 8. Logs

There is one line per run, with no AP names, addresses or credentials:

```
2026-10-12 14:15:02 INFO run: 47 zones sent, 12 unmapped APs ignored, 9 excluded APs ignored, HTTP 200
```

Exit codes: `0` OK, `1` the run failed (nothing sent, it will retry next run), `2` a config problem.
