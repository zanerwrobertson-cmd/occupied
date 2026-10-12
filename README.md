# Occupied

Shows Western University students how busy campus buildings are, in near real time.
Open it, and you know if a place is packed in about two seconds.

Built with **Expo SDK 57 / React Native**, so it runs on iOS, Android and the web from one codebase.

> Status: front-end prototype running on **mock data**. No backend yet.

## What's in it

- **Home (list):** search, a Favorites section pinned at the top, every building as a card with a level badge and a trend, A–Z / Quietest-first sort, and an "Updated X min ago" stamp.
- **Map:** a List | Map toggle, colour-coded pins with a 1–4 bar glyph, a legend, and a bottom sheet that opens the building's detail page.
- **Building detail:** a large "Right now" level, a trend, a comparison with the usual level for this hour, floors (e.g. Weldon 1–5) and sub-areas (e.g. The Spoke inside the UCC), a "Typical <weekday>" hourly chart with the current hour highlighted, and a Favorites star.
- **Light and dark mode** follow the system setting.
- Busyness is shown as **Quiet / Moderate / Busy / Very Busy**, always **relative to that building's normal range** and never as a headcount. Every level has a text label, so colour is never the only cue.

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
src/
  app/                    # Expo Router screens (every file is a route)
    _layout.tsx           # fonts, providers, stack navigator
    index.tsx             # Home: list + map toggle
    building/[id].tsx     # Building detail
  components/             # BuildingCard, LevelBadge/Bars, CampusMap, TypicalDayChart, ...
  data/
    types.ts              # Level, Building, Snapshot
    buildings.ts          # static building info + mock readings
    source.ts             # <- the one place to plug in the real feed
  lib/levels.ts           # level/trend helpers, "usual for this hour", time formatting
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
- [ ] **The map is schematic.** Pin positions are made up. Replace them with real coordinates (`react-native-maps`) or an accurate illustrated campus map.
- [ ] **Typical-day curves are placeholders** (four shared shapes). They should come from historical data, per building and per weekday.
- [ ] The "usual for this hour" line uses the device clock against static mock data, so at night it can say odd things such as "Busier than usual for 11 PM".
- [ ] App icon and splash screen are still the Expo defaults.
- [ ] No Western logo, crest or official branding is used. Keep it that way unless the university grants permission.
