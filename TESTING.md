# Testing the data pipeline

Test the whole flow (ITS → backend → app) on your own computer, using fake data from a simulator.

```
scripts/simulator.ts  ──POST /ingest──▶  server/ (Node + SQLite)  ──GET /occupancy──▶  app
   (fake Western ITS)                     server/data/occupied.db
```

## 1. One-time setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` (it's git-ignored, so never commit it):

```bash
INGEST_KEY=<a long random string>          # shared by the simulator and the server
API_URL=http://localhost:4000              # where the simulator posts
EXPO_PUBLIC_API_URL=http://localhost:4000  # where the app reads; leave empty for mock data
```

Generate a key with `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
`INGEST_KEY` never ends up in the app. Only `EXPO_PUBLIC_` variables are built into the app.

## 2. Run it (three terminals)

```bash
# 1. Backend
npm run server

# 2. Fake ITS: 6 weeks of history first (about 5 s), then a live reading every 10 seconds
npm run sim:backfill
npm run sim -- --live --interval=10s

# 3. App
npm run web          # or: npm start, then scan the QR code with Expo Go
```

After changing `.env.local`, restart Expo with `npx expo start --clear`. The `EXPO_PUBLIC_` values are
built into the app when it's bundled.

## 3. Check the output

```bash
curl http://localhost:4000/occupancy
```

Use `?at=` to see the campus at another time, using history from the backfill:

```bash
curl "http://localhost:4000/occupancy?at=2026-10-08T20:00:00-04:00"   # a weekday at 8 PM: Weldon Very Busy
curl "http://localhost:4000/occupancy?at=2026-10-11T10:00:00-04:00"   # Sunday at 10 AM: Weldon Quiet
```

Things to expect:

- **At night everything is Closed.** Closed buildings are left out of the feed, and the app applies
  opening hours. The newest reading also gets older than 30 minutes, so the app shows
  "Data may be out of date". To see live colours, run during campus hours.
- **Levels are relative.** Each one compares the current count with that zone's or building's
  95th-percentile count over the last 4 weeks. With under a week of history, the maximum count
  so far is used instead.

## On your phone

The phone runs the app, so for it `localhost` means the phone itself, not your computer.
**`EXPO_PUBLIC_API_URL` must use your computer's LAN IP address:**

1. Run `ipconfig` (Windows) or `ipconfig getifaddr en0` (Mac) and find your IPv4 address, e.g. `192.168.4.143`.
   `npm run server` also prints it ("LAN: http://…:4000").
2. Set `EXPO_PUBLIC_API_URL=http://192.168.4.143:4000` in `.env.local`.
3. Restart Expo with `npx expo start --clear` and open the app in Expo Go. The phone must be on the same Wi-Fi.
4. If it can't connect, allow Node.js through the Windows Firewall on private networks.

`npx expo start --tunnel` only tunnels the app bundle, not port 4000, so it doesn't help the
phone reach the backend. On networks that isolate devices (often campus Wi-Fi), use a phone
hotspot or home Wi-Fi instead.

Your LAN IP can change when you reconnect, so update `.env.local` if the app stops loading.

## Simulator reference

```bash
npm run sim -- --once                        # one reading now (the default)
npm run sim -- --live --interval=15m         # keep sending (10s, 1m, 15m, …)
npm run sim -- --backfill=6w                 # history at 15-minute steps (also 3d, 12h, …)
npm run sim -- --once --dry-run              # print the payload, don't send
npm run sim -- --scenario=<name>             # edge cases, below
```

| Scenario | What it does | What you should see |
|---|---|---|
| `missing-zone` | Leaves `weldon-f3` out (works with `--live`) | Weldon Floor 3 shows "No data yet" |
| `all-below-threshold` | Every zone reported as `"<10"` (works with `--live`) | Open buildings show "Low activity" |
| `stale` | Sends one reading from 45 minutes ago, then stops | "Data may be out of date" banner |
| `bad-key` | Wrong `x-ingest-key` | `401`, nothing stored |
| `malformed` | Bad JSON, missing/non-UTC timestamp, raw counts under 10, a MAC address field, duplicate zone | `400` for each, nothing stored |
| `duplicate-timestamp` | Same timestamp twice with different counts | Both `200`; the second overwrites the first |
| `out-of-order` | A reading, then an older one arriving late | Both `200`; the latest reading stays current |

Request scenarios print PASS/FAIL for each request and exit non-zero on a failure. Stop any
`--live` run before trying `stale`.

Payload rules (enforced by the server, so ITS has to follow them too): `timestamp` is ISO 8601 UTC.
Each zone sends only `zone` and `devices`, and `devices` is a whole number ≥ 10 or the string `"<10"`.
Any extra field, such as a MAC address or access-point id, is rejected. Zones the app doesn't know
(e.g. residences) are dropped and listed under `ignored` in the response.

## Unit tests

```bash
npm test
```

They cover p95, level thresholds, trend, cold start, typical day, the `<10` handling, the building
sum, every simulator scenario, and a full 6-week backfill. The backfill test checks that Weldon is
busy at 8 PM on a weekday and quiet when it opens on Sunday.

## Reset

Stop the server and delete `server/data/` to start from an empty database.

## Notes and limitations

- **Time zone.** Opening hours, curves and typical-day buckets use the computer's local time. Run
  the server and simulator in campus time (America/Toronto).
- **Opening hours are placeholders** (`src/data/buildings.ts`, marked TODO-verify). With them,
  Weldon isn't open at 8 AM on Sunday, so it shows Closed then, not Quiet.
- **`"<10"` counts as 0** when zones are added up for a building total.
- **Moving to Supabase.** `server/schema.sql` is the Postgres table. `server/logic.ts` and
  `server/snapshot.ts` have no I/O, so a Supabase version only needs to implement the two-method
  `Store` interface in `server/store.ts`.
