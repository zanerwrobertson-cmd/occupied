/**
 * DATA TYPES — the "shape" of every piece of data in the app, shared with the server.
 *
 * TypeScript types don't exist when the app runs; they let the editor and `npm run typecheck`
 * catch mistakes like a misspelt field or a missing level.
 *
 * The big picture:
 *   BuildingInfo     static facts (name, hours, …) — written by hand in buildings.ts
 *   + live reading   status, level, trend, floors/areas, typicalDay — from the feed
 *   = Building       what screens actually display
 *   Snapshot         all Buildings + when the data was recorded — what /occupancy returns
 */

/** 0 Quiet · 1 Moderate · 2 Busy · 3 Very Busy — always relative to the building's own normal range. */
export type Level = 0 | 1 | 2 | 3;

/** Compared with the last few readings: getting busier, quieter, or about the same. */
export type Trend = 'up' | 'down' | 'steady';

/**
 * live   — has a level to show
 * nodata — no reading from the feed
 * closed — outside opening hours
 * low    — below the minimum-count threshold, too few signals to rate
 */
export type Status = 'live' | 'nodata' | 'closed' | 'low';

/** Anything that can be shown as a level or a neutral status. */
export type Rated = { status?: Status; level?: Level };

/**
 * One floor or sub-area inside a building, as shown in the app.
 * The `|` means "either": a zone with a level, OR a grey zone (low / no data) with no level.
 * Leaving out `status` means live (the mock data does this to stay short).
 */
export type Zone =
  | { name: string; status?: 'live'; level: Level }
  | { name: string; status: 'low' | 'nodata'; level?: undefined };

/**
 * A sensor zone as ITS reports it. id = `<building>-<floor or sub-area>`, e.g. "weldon-f1", "ucc-spoke".
 * "main" zones cover a whole building that has no finer breakdown; they aren't listed as floors or areas.
 */
export type ZoneInfo = { id: string; building: string; name: string; kind: 'floor' | 'area' | 'main' };

/** [open, close) in local hours, 0–24. null = closed all day. */
export type DayHours = readonly [open: number, close: number] | null;

/** Indexed by Date.getDay(), Sunday first. */
export type WeeklyHours = readonly [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

/** Static facts about a building that don't change between refreshes. */
export type BuildingInfo = {
  /** Short lowercase id used everywhere: URLs, zone ids, favourites, the map. e.g. "weldon" */
  id: string;
  name: string;
  /** Short code shown on map pins */
  short: string;
  /** Other names people search for, e.g. "gym" */
  aliases?: string[];
  /** Opening hours for each day of the week */
  hours: WeeklyHours;
  /** Heading for the sub-area list, e.g. "Inside the UCC" */
  areasHeading?: string;
};

/** The parts of a reading that sit inside a building (shared by BuildingReading and Building). */
type Zones = {
  floors?: Zone[];
  areas?: Zone[];
  /**
   * Typical busyness by hour for today's weekday, 7 AM → 11 PM (17 values, 0–100).
   * Comes from the feed's history; missing when there isn't any yet.
   */
  typicalDay?: number[];
};

/** Live reading for one building from the latest refresh. */
export type BuildingReading = { id: string } & Zones &
  ({ status?: 'live'; level: Level; trend: Trend } | { status: 'low'; level?: undefined; trend?: undefined });

/**
 * Everything a screen needs about one building: the static info (&) its zones (&) either a
 * live level + trend, or a grey status (closed / no data / low activity).
 * Checking `b.status === 'live'` lets TypeScript know `b.level` and `b.trend` exist.
 */
export type Building = BuildingInfo &
  Zones &
  (
    | { status: 'live'; level: Level; trend: Trend }
    | { status: Exclude<Status, 'live'>; level?: Level; trend?: Trend }
  );

/** One complete set of data: what GET /occupancy returns and what the app keeps in memory. */
export type Snapshot = {
  /** Epoch ms of the reading */
  updatedAt: number;
  buildings: Building[];
};
