# Privacy: what leaves the network and what never does

## The only data that leaves Western's network

Every 15 minutes, one message containing:

| Field | Example | What it is |
|---|---|---|
| `timestamp` | `2026-10-12T18:15:00Z` | When the counts were taken |
| `zone` | `weldon-f1`, `ucc-spoke` | A building + floor or area, never an access point |
| `devices` | `212`, or `"<10"` | **Total** connected devices in that zone, from all its access points added together |

That's all. It's comparable to a door counter for each floor.

## What never leaves the network

| Never sent | How the agent makes sure |
|---|---|
| Device **MAC addresses** | No adapter requests per-client data: every vendor call returns counts per access point. Controller responses do include each *access point's* own MAC and IP; the agent reads only the AP name and its client count and copies nothing else. Before sending, the message is scanned for anything MAC-shaped; if one is found, nothing is sent. |
| **IP addresses** | Never copied, and the message is scanned for IPv4/IPv6 shapes before sending. |
| **Access point names** | Converted to zone ids; the message is checked against every AP name before sending. |
| **Usernames, device types, individual locations** | Never requested or read. |
| **Anything from residences** | Residence buildings are excluded by rule (named in config, plus any building id containing "resid"), and checked again before sending. |
| **Exact small counts** | Any zone with fewer than 10 devices is sent as `"<10"`. The threshold can be raised in config.toml but not lowered below 10. |

If any check fails, the run **sends nothing** and logs why, without including the offending value.

The Occupied server enforces the same rules independently. It rejects any message with extra
fields (such as a MAC address) or with an exact count under 10.

## What the agent stores locally

**No client data.** Counts exist in memory for a few seconds during a run and are gone when it
exits. If sending fails, the run is skipped, not saved for later. The only file written is an
Aruba sign-in token (when Aruba is the vendor), which is a credential, not client data.

Logs contain one line per run with counts of zones and dropped APs: no names, addresses or
credentials.

## What the Occupied server does with it

- **Turns totals into a relative level** ("Quiet", "Busy", …) by comparing each zone with its own
  history. Students see **only these levels**, never device counts.
- **Keeps the zone totals** to work out "normal" levels. The calculations use the last 8 weeks.
  **Automatic deletion of anything older than 8 weeks is planned before launch** (not yet built).
  Western can ask for all data to be deleted at any time.
- **Never combines** this with any other data about individuals, because it has none.
- Access is protected by a secret key that ITS holds and can revoke at any time.

## Who can see what

| | Sees |
|---|---|
| Students using the app | Busy levels per building/floor/area, and when they were last updated |
| The Occupied team | Zone totals and timestamps |
| Nobody outside ITS | Anything about individual devices or access points |
