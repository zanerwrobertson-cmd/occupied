/** 0 Quiet · 1 Moderate · 2 Busy · 3 Very Busy — always relative to the building's own normal range. */
export type Level = 0 | 1 | 2 | 3;

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

export type Zone =
  | { name: string; status?: 'live'; level: Level }
  | { name: string; status: 'low'; level?: undefined };

/** [open, close) in local hours, 0–24. null = closed all day. */
export type DayHours = readonly [open: number, close: number] | null;

/** Indexed by Date.getDay(), Sunday first. */
export type WeeklyHours = readonly [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

/** Static facts about a building that don't change between refreshes. */
export type BuildingInfo = {
  id: string;
  name: string;
  /** Short code shown on map pins */
  short: string;
  /** Other names people search for, e.g. "gym" */
  aliases?: string[];
  hours: WeeklyHours;
  /**
   * Typical busyness by hour, 7 AM → 11 PM (17 values, 0–100).
   * Should eventually come from historical data per weekday.
   */
  typicalDay: number[];
  /** Heading for the sub-area list, e.g. "Inside the UCC" */
  areasHeading?: string;
};

type Zones = { floors?: Zone[]; areas?: Zone[] };

/** Live reading for one building from the latest refresh. */
export type BuildingReading = { id: string } & Zones &
  ({ status?: 'live'; level: Level; trend: Trend } | { status: 'low'; level?: undefined; trend?: undefined });

export type Building = BuildingInfo &
  Zones &
  (
    | { status: 'live'; level: Level; trend: Trend }
    | { status: Exclude<Status, 'live'>; level?: Level; trend?: Trend }
  );

export type Snapshot = {
  /** Epoch ms of the reading */
  updatedAt: number;
  buildings: Building[];
};
