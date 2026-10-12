/** 0 Quiet · 1 Moderate · 2 Busy · 3 Very Busy — always relative to the building's own normal range. */
export type Level = 0 | 1 | 2 | 3;

export type Trend = 'up' | 'down' | 'steady';

export type Zone = {
  name: string;
  level: Level;
};

/** Static facts about a building that don't change between refreshes. */
export type BuildingInfo = {
  id: string;
  name: string;
  /** Short code shown on map pins */
  short: string;
  /** Position on the schematic map, in a 390 × 560 design space */
  map: { x: number; y: number };
  /**
   * Typical busyness by hour, 7 AM → 11 PM (17 values, 0–100).
   * Should eventually come from historical data per weekday.
   */
  typicalDay: number[];
  /** Heading for the sub-area list, e.g. "Inside the UCC" */
  areasHeading?: string;
};

/** Live reading for one building from the latest refresh. */
export type BuildingReading = {
  id: string;
  level: Level;
  trend: Trend;
  floors?: Zone[];
  areas?: Zone[];
};

export type Building = BuildingInfo & BuildingReading;

export type Snapshot = {
  /** Epoch ms of the reading */
  updatedAt: number;
  buildings: Building[];
};
