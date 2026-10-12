# Occupied

Shows Western University students how busy campus buildings are, in near real time.
Open it, and you know if a place is packed in about two seconds.

Built with **Expo SDK 57 / React Native**, so it runs on iOS, Android and the web from one codebase.

> Status: front-end prototype running on **mock data**. No backend yet.

## What's in it

- **Home (list):** search, a Favorites section pinned at the top, every building as a card with a level badge and a trend, A–Z / Quietest-first sort, and an "Updated X min ago" stamp.
- **Map:** a List | Map toggle and a real campus map built from OpenStreetMap building outlines, each coloured by its level, with 1–4 bar pins. Drag to pan, and pinch, scroll or use the + / − buttons to zoom. A legend strip sits above the map, and tapping a building opens a summary card that links to its detail page.
- **Building detail:** a large "Right now" level, a trend, a comparison with the usual level for this hour, floors (e.g. Weldon 1–5) and sub-areas (e.g. The Spoke inside the UCC), today's opening hours, a "Typical day" hourly chart with the current hour highlighted, and a Favorites star.
- **Light and dark mode** follow the system setting.
- Busyness is shown as **Quiet / Moderate / Busy / Very Busy**, always **relative to that building's normal range** and never as a headcount. Every level has a text label, so colour is never the only cue. Grey states (**No data yet**, **Closed**, **Low activity**, and the stale-data banner) are labelled the same way.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go on your phone
npm run web           # or open in a browser
```

Other scripts:

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm run export:web    # static web build into dist/
```

## Project layout

```
scripts/
  build-campus-map.mjs    # regenerates src/data/campusMap.ts from OpenStreetMap
src/
  app/                    # Expo Router screens (every file is a route)
    _layout.tsx           # fonts, providers, stack navigator
    index.tsx             # Home: list + map toggle
    building/[id].tsx     # Building detail
  components/             # BuildingCard, LevelBadge/Bars, CampusMap, TypicalDayChart, ...
  data/
    types.ts              # Level, Building, Snapshot
    buildings.ts          # static building info, opening hours + mock readings
    campusMap.ts          # generated OpenStreetMap shapes (scripts/build-campus-map.mjs)
    source.ts             # <- the one place to plug in the real feed
  lib/levels.ts           # level/trend/status helpers, "usual for this hour", time formatting
  lib/hours.ts            # opening hours: open now?, today's hours, "closed" status
  lib/search.ts           # search across names, aliases, floors and areas
  state/
    occupancy.tsx         # fetch + poll + refresh when the app returns to the foreground
    favorites.tsx         # favorites, saved on the device with AsyncStorage
  theme/theme.ts          # colour tokens (light/dark), level colours, font families
```

## Hooking up real data

Replace the body of `fetchSnapshot()` in `src/data/source.ts`. It must return:

```ts
{ updatedAt: number /* epoch ms */, buildings: Building[] }
```

The backend should convert raw signals (Wi-Fi associations, door counters, etc.) into a `Level` (0–3) **relative to each building's own history**. The app never needs headcounts. The app polls every 5 minutes, refreshes when it returns to the foreground, and the backend is expected to update every 10–15 minutes.

## Known gaps / TODO

- [ ] **Real data feed.** Everything is currently mocked in `src/data/buildings.ts`.
- [x] **Real campus map.** Building outlines, roads, paths, green space and the river come from OpenStreetMap (© OpenStreetMap contributors, ODbL), generated into `src/data/campusMap.ts` by `node scripts/build-campus-map.mjs`. To show a new building on the map, add its OSM id to `OSM_IDS` in that script and run it again.
- [ ] **Typical-day curves are placeholders** (four shared shapes). They should come from historical data, per building and per weekday. Until then the chart is labelled "Typical day", not a weekday.
- [ ] **Opening hours are placeholders** (`*_HOURS` in `src/data/buildings.ts`, marked TODO-verify). Replace them with each building's published hours, including exam-season and holiday changes.
- [ ] App icon and splash screen are still the Expo defaults.
- [x] Buildings with no reading stay in the list and on the map as **No data yet** (grey) instead of disappearing. "Quietest first" puts them last.
- [x] Buildings outside opening hours show **Closed** (grey) and never "Quiet". The detail page shows today's hours.
- [x] Floors and areas below the minimum-count threshold show **Low activity** (grey), not Quiet.
- [x] Search ignores case and punctuation, and also matches aliases (e.g. "gym", "spoke", "library") and floor and area names.
- [x] "Usual for this hour" no longer appears for closed buildings or outside charted hours, so no more "Busier than usual for 11 PM".
- [x] No hard-coded default favorites. An empty Favorites list shows a one-line hint instead.
- [x] Data older than 30 minutes (`STALE_MS` in `src/data/source.ts`), or a failed refresh, shows a "Data may be out of date" banner and greys the level badges while keeping the last data on screen.
- [ ] No Western logo, crest or official branding is used. Keep it that way unless the university grants permission.
