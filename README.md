# Occupied

Shows Western University students how busy campus buildings are, in near real time.
Open it, and you know if a place is packed in about two seconds.

Built with **Expo SDK 57 / React Native**, so one codebase runs on iOS, Android and the web.

> **Status:** the app, a local backend and a fake data feed all work end to end on your computer.
> The real Western ITS (Wi-Fi) feed isn't connected yet, and the backend isn't hosted online yet.
> See [What's real and what's still missing](#whats-real-and-whats-still-missing).

This README is the guide to the code: what each part does, how data moves through it, and how
to make common changes. Every source file also has comments at the top and through the code.
For running the full data pipeline step by step, see **[TESTING.md](TESTING.md)**.

---

## Contents

1. [What the app does](#1-what-the-app-does)
2. [Run it](#2-run-it)
3. [The big picture](#3-the-big-picture)
4. [Key ideas](#4-key-ideas)
5. [Tour of the code, file by file](#5-tour-of-the-code-file-by-file)
6. [Follow one refresh from start to finish](#6-follow-one-refresh-from-start-to-finish)
7. [How do I…? (common changes)](#7-how-do-i-common-changes)
8. [Commands](#8-commands)
9. [What's real and what's still missing](#whats-real-and-whats-still-missing)
10. [Known gaps / TODO](#known-gaps--todo)

---

## 1. What the app does

- **Home (list):** search, a Favorites section at the top, and every building as a card with its
  level and trend. You can sort A–Z or Quietest first, and an "Updated X min ago" stamp shows how
  fresh the data is.
- **Map:** a real campus map built from OpenStreetMap. Each building is coloured by its level and
  has a pin. Drag to pan; pinch, scroll or use **+ / −** to zoom. Tapping a building opens a
  summary card that links to its detail page.
- **Building detail:**
  - a big "Right now" level, its trend, and "Busier than usual for 2 PM"
  - floors (e.g. Weldon 1–5) and sub-areas (e.g. The Spoke in the UCC)
  - today's opening hours, a typical-day chart, and a Favorites star
- **Light and dark mode** follow the phone's setting.

Busyness is always one of **Quiet / Moderate / Busy / Very Busy**. It's **relative to that place's
normal range**, never a headcount. When there's no level to show, the app uses grey states instead:
**Closed**, **No data yet**, **Low activity**, plus a **"Data may be out of date"** banner when the
data is stale. Every state has a text label, so colour is never the only cue.

## 2. Run it

```bash
npm install
npm run web           # opens in your browser at http://localhost:8081
npm start             # or: scan the QR code with the Expo Go app on your phone
```

On its own this uses **mock data** (fake levels built into the app). To run the **whole pipeline**
(fake ITS feed → local server → app), follow [TESTING.md](TESTING.md). In short:

```bash
npm run server                         # terminal 1: the backend
npm run sim:backfill                   # terminal 2: 6 weeks of fake history…
npm run sim -- --live --interval=10s   #             …then a new reading every 10 s
npm run web                            # terminal 3: the app (with EXPO_PUBLIC_API_URL set)
```

## 3. The big picture

```
 ┌────────────────────┐   POST /ingest   ┌───────────────────────────┐  GET /occupancy  ┌──────────────┐
 │ Western ITS        │ ───────────────▶ │ Backend  (server/)        │ ───────────────▶ │ App  (src/)  │
 │ (for now: the      │  zone counts     │ • checks key, validates   │  levels, trends, │ • list, map, │
 │  simulator in      │  every 15 min    │ • stores in SQLite        │  typical day     │   details    │
 │  scripts/)         │                  │ • works out levels (p95)  │                  │ • polls 5 min│
 └────────────────────┘                  └───────────────────────────┘                  └──────────────┘
```

1. **ITS** (Western's IT services) counts connected Wi-Fi devices per area every 10–15 minutes.
   Until they approve access, `scripts/simulator.ts` makes realistic fake counts instead.
2. **The backend** stores the counts. When asked, it turns them into levels by comparing each
   count with what's normal for that place.
3. **The app** asks the backend for the latest levels every 5 minutes and shows them.

The app never sees headcounts or anything that could identify a person, only levels.

## 4. Key ideas

### React Native + Expo
You write the app once in **TypeScript** (JavaScript with types), using **React** components.
React Native turns them into real iOS/Android screens, or web pages. **Expo** is the toolkit
around it: the dev server, the Expo Go app for testing on your phone, and cloud builds.

### Components, props and state
- A **component** is a function that returns what to draw, e.g. `BuildingCard` draws one card.
- **Props** are the inputs you give it: `<BuildingCard building={b} />`.
- **State** (`useState`) is data a component remembers. Changing it redraws the screen.
- **Hooks** are functions starting with `use…` (`useState`, `useEffect`, `useTheme`, …) that give
  components state, side effects (timers, fetching), or shared data.

### Screens and navigation (Expo Router)
Every file in `src/app/` is a screen, and its path is its URL: `index.tsx` is `/`, and
`building/[id].tsx` is `/building/weldon` (the `[id]` part becomes a parameter).
`_layout.tsx` wraps all of them.

### Shared data (context providers)
Two "providers" in `_layout.tsx` hold data every screen needs:
- `OccupancyProvider`: the busyness data, refreshed automatically. Screens read it with `useOccupancy()`.
- `FavoritesProvider`: the starred buildings, saved on the device. Screens read it with `useFavorites()`.

### How a level is worked out
A raw count means nothing on its own: 212 devices is packed for a small floor but empty for the
SSC. So the backend compares each count with that place's own history:

```
ratio = devices now ÷ baseline       baseline = 95th-percentile count over the last 4 weeks
ratio < 0.35 → Quiet    < 0.55 → Moderate    < 0.75 → Busy    otherwise → Very Busy
```

- **Trend:** the latest count vs the average of the previous 3. More than 10% higher is
  "Getting busier", more than 10% lower is "Getting quieter", anything in between is "Steady".
- **Typical day:** for today's weekday, the median ratio at each hour over the last 8 weeks.
- **Cold start:** with under a week of history, the baseline is the highest count seen so far.
- **A building's level** is the sum of its floors/areas compared with the building's own baseline.

### The grey states
| State | When | Who decides |
|---|---|---|
| **Closed** | Outside the building's opening hours | The app (`src/lib/hours.ts`) |
| **No data yet** | The feed didn't report that building or zone | Server, or app in mock mode |
| **Low activity** | Fewer than 10 devices (sent as `"<10"`) | Server |
| **Data may be out of date** | Data over 30 min old, or the last refresh failed | The app (`src/state/occupancy.tsx`) |

### Privacy by design
The server only accepts a zone id and a count. A count under 10 must be sent as `"<10"` (a small
number could identify someone), and any extra field, such as a MAC address, gets the whole reading
rejected. So identifying data can never end up stored.

## 5. Tour of the code, file by file

```
occupied/
├── src/                      THE APP
│   ├── app/                  screens (Expo Router: file = screen)
│   ├── components/           reusable pieces of UI
│   ├── data/                 data types, building list, where data comes from
│   ├── lib/                  small helper functions (no UI)
│   ├── state/                shared data for all screens
│   └── theme/                colours and fonts
├── server/                   THE BACKEND (Node + SQLite)
├── scripts/                  tools: fake ITS feed, map generator
├── TESTING.md                how to run the whole pipeline
└── .env.example              settings template → copy to .env.local
```

### `src/app/`: the screens
| File | What it does |
|---|---|
| `_layout.tsx` | Runs first. Loads fonts, wraps the app in the two providers, and sets up the screen stack. |
| `index.tsx` | Home screen: header, List/Map switch, search, favourites, sorted building list, or the map. |
| `building/[id].tsx` | Detail screen for one building: "Right now" card, floors/areas, hours, typical-day chart. |

### `src/components/`: building blocks
| File | What it draws |
|---|---|
| `BuildingCard.tsx` | One row in the list: name, trend, level badge. |
| `Level.tsx` | `LevelBadge` ("● Busy" pill), `LevelBars` (▂▄▆█ shape cue), `TrendLabel` ("↗ Getting busier"). |
| `CampusMap.tsx` | The interactive map: legend, OSM drawing, pins, pan/zoom gestures, zoom buttons, summary card. |
| `TypicalDayChart.tsx` | The 7 AM–11 PM bar chart, current hour highlighted. |
| `ZoneList.tsx` | The "By floor" / "Inside the UCC" box. |
| `StaleBanner.tsx` | "Data may be out of date". |
| `Segmented.tsx` | The List / Map and A–Z / Quietest-first switches. |
| `SectionTitle.tsx` | Small uppercase section headings. |
| `Icons.tsx` | All icons, drawn as small SVGs. |

### `src/data/`: what the data is and where it comes from
| File | What it does |
|---|---|
| `types.ts` | The shape of all data (`Level`, `Building`, `Zone`, `Snapshot`, …). Shared with the server. |
| `buildings.ts` | **Hand-edited.** Every building (name, map code, search aliases, opening hours), its sensor zones (`weldon-f1`, `ucc-spoke`, …), and mock readings. |
| `source.ts` | `fetchSnapshot()`: calls the backend if `EXPO_PUBLIC_API_URL` is set, otherwise returns mock data. Also holds `REFRESH_MS` (5 min) and `STALE_MS` (30 min). |
| `campusMap.ts` | **Generated** by `scripts/build-campus-map.mjs`, so don't edit it by hand. The building outlines and map layers. |

### `src/lib/`: helper functions
| File | What it does |
|---|---|
| `levels.ts` | Level/trend/status text, "Quietest first" ordering, hour formatting, "Busier than usual…", "Updated X min ago". |
| `hours.ts` | Open now? Today's hours text. Marks buildings Closed outside their hours. |
| `search.ts` | Search matching (name, code, aliases, floor and area names; ignores case and punctuation). |

### `src/state/`: shared data
| File | What it does |
|---|---|
| `occupancy.tsx` | Fetches on start, every 5 min and when the app reopens. Applies opening hours and works out "stale". |
| `favorites.tsx` | Starred buildings, saved on the device with AsyncStorage. |

### `src/theme/theme.ts`
All colours (light + dark), the four level colours, the grey for neutral states, and fonts.
`display(building)` is the one function that turns any building or zone into colours plus a label.

### `server/`: the backend
| File | What it does |
|---|---|
| `index.ts` | The HTTP server: routes `POST /ingest` and `GET /occupancy`, reads settings from `.env.local`. |
| `ingest.ts` | Checks the key, validates every reading strictly (privacy rules), and saves it. |
| `snapshot.ts` | Builds the `/occupancy` answer: groups readings and works out each zone's and building's level, trend and typical day. |
| `logic.ts` | The maths: p95, median, ratio → level, trend, baseline, typical day. No database code. |
| `store.ts` | The two-method storage interface (`upsert`, `since`), plus an in-memory version for tests. |
| `sqliteStore.ts` | The real storage: a SQLite file at `server/data/occupied.db`. |
| `schema.sql` | The same table for Postgres/Supabase, for when the backend is hosted. |
| `__tests__/` | Jest tests for the maths and the snapshot. |

### `scripts/`: tools
| File | What it does |
|---|---|
| `simulator.ts` | Command-line fake ITS feed: `--once`, `--live`, `--backfill`, `--dry-run`, `--scenario`. |
| `sim/core.ts` | How fake counts are made (capacities, daily curves, weekends, noise) and the edge-case scenarios. |
| `build-campus-map.mjs` | Downloads OpenStreetMap data and writes `src/data/campusMap.ts`. |
| `__tests__/` | Jest tests for the simulator and every scenario, plus a full 6-week end-to-end check. |

## 6. Follow one refresh from start to finish

1. **The simulator** (`scripts/simulator.ts` → `sim/core.ts`) works out counts for every open
   zone, e.g. `weldon-f1: 212`, and POSTs them to the server with the secret key.
2. **`server/index.ts`** receives `POST /ingest` and passes it to **`ingest.ts`**, which checks
   the key, validates the reading, and saves one row per zone in **SQLite**.
3. Up to 5 minutes later, the app's **`state/occupancy.tsx`** timer calls **`data/source.ts`**
   `fetchSnapshot()`, which requests `GET /occupancy`.
4. **`server/snapshot.ts`** loads 8 weeks of rows and, for each building, adds up its zones. It
   compares the total with the building's p95 using **`logic.ts`**, which gives a level and
   trend, and returns every building as JSON.
5. Back in the app, `occupancy.tsx` marks closed buildings **Closed** (`lib/hours.ts`), decides
   whether the data is **stale**, and shares the result with every screen.
6. **`app/index.tsx`** redraws: each **`BuildingCard`** asks **`theme.ts`** `display()` for its
   colours and label, e.g. "● Busy" in orange.

## 7. How do I…? (common changes)

| I want to… | Do this |
|---|---|
| **Fix opening hours** | Edit `LIBRARY_HOURS`, `ACADEMIC_HOURS`, etc. in `src/data/buildings.ts`. Pairs are `[open, close]` in 24-hour time. Give a building its own `weekly(...)` if its hours differ. |
| **Add a building** | 1) Add it to `BUILDINGS` in `src/data/buildings.ts`. 2) Give it zones in `ZONES`, or it automatically gets one `-main` zone. 3) Add its OpenStreetMap id to `OSM_IDS` in `scripts/build-campus-map.mjs` and run `node scripts/build-campus-map.mjs`. 4) Give it a capacity in `scripts/sim/core.ts`. |
| **Add floors to a building** | In `ZONES`, replace its `main` zone with `...floors('id', n)` or `...areas('id', [...])`. Zone ids must match what ITS sends. |
| **Change what counts as Busy** | `levelFromRatio` in `server/logic.ts` (and `valueToLevel` in `src/lib/levels.ts` to match). |
| **Change refresh / stale timing** | `REFRESH_MS` and `STALE_MS` in `src/data/source.ts`. |
| **Change colours** | `src/theme/theme.ts`. Keep text readable (4.5:1 contrast). |
| **Add a search word** | Add it to the building's `aliases` in `src/data/buildings.ts`. |
| **Point the app at a server** | Set `EXPO_PUBLIC_API_URL` in `.env.local`, then restart Expo with `npx expo start --clear`. |
| **Start with an empty database** | Stop the server and delete `server/data/`. |
| **Refresh the map from OpenStreetMap** | `node scripts/build-campus-map.mjs` |

## 8. Commands

```bash
npm run web            # app in the browser
npm start              # app on your phone via Expo Go
npm run server         # local backend on port 4000
npm run sim -- --once  # one fake reading (see TESTING.md for all modes)
npm run sim:backfill   # 6 weeks of fake history
npm test               # Jest tests (logic, snapshot, simulator scenarios)
npm run typecheck      # TypeScript check
npm run lint           # ESLint
npm run build:web      # static web build into dist/
```

## What's real and what's still missing

**Real, kept code:** the app (including fetching from the API, refreshing, and the stale banner),
the backend's `POST /ingest` and `GET /occupancy` with all the level maths, the privacy checks,
and the database layer. The simulator only replaces where the numbers come from.

**Still needed before real data works:**
1. **An adapter for Western's system.** If ITS pushes readings in our format to `/ingest`, this
   isn't needed. More likely we'll have to fetch from their Wi-Fi controller's API (e.g. Cisco,
   Aruba or Meraki), map their access points to our zone ids, and total the counts. That needs
   their API documentation and a sample response.
2. **Hosting.** The server runs on your laptop. It needs to run online (e.g. Supabase, using
   `server/schema.sql`, plus a Supabase version of `store.ts`) so students' phones can reach it.
3. **Real campus details:** opening hours, and the zone list checked against what ITS reports.
4. **Production basics:** HTTPS, deleting old readings, and an alert if the feed stops.

## Known gaps / TODO

- [ ] **Real data feed.** The backend and simulator work end to end locally (TESTING.md). Still to do: connect Western ITS, host the backend (e.g. Supabase, using `server/schema.sql`), and check the zone ids against what ITS actually reports.
- [ ] **Opening hours are placeholders** (`*_HOURS` in `src/data/buildings.ts`, marked TODO-verify). Replace them with each building's published hours, including exam-season and holiday changes.
- [ ] App icon and splash screen are still the Expo defaults.
- [ ] No Western logo, crest or official branding is used. Keep it that way unless the university grants permission.
- [x] **Real campus map.** Building outlines, roads, paths, green space and the river come from OpenStreetMap (© OpenStreetMap contributors, ODbL), generated into `src/data/campusMap.ts` by `node scripts/build-campus-map.mjs`.
- [x] **Typical-day curves come from the API** (median per weekday and hour over up to 8 weeks). The mock fallback still uses four shared placeholder shapes, so the chart is labelled "Typical day".
- [x] Buildings with no reading stay in the list and on the map as **No data yet** (grey). "Quietest first" puts them last.
- [x] Buildings outside opening hours show **Closed** (grey) and never "Quiet". The detail page shows today's hours.
- [x] Floors and areas below the minimum-count threshold show **Low activity** (grey), not Quiet.
- [x] Search ignores case and punctuation, and also matches aliases (e.g. "gym", "spoke", "library") and floor and area names.
- [x] "Usual for this hour" doesn't appear for closed buildings or outside charted hours.
- [x] No hard-coded default favorites. An empty Favorites list shows a one-line hint instead.
- [x] Data older than 30 minutes (`STALE_MS`), or a failed refresh, shows a "Data may be out of date" banner and greys the level badges while keeping the last data on screen.
