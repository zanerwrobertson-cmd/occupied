/**
 * STORAGE — the interface between the server's logic and its database.
 *
 * The rest of the server only ever calls `upsert` and `since`, so swapping SQLite for
 * Supabase/Postgres later means writing one new class, not touching the logic.
 */

/** One stored reading. `devices` is null when ITS sent "<10". */
export type Row = { zone: string; ts: number; devices: number | null; belowThreshold: boolean };

/**
 * Everything the server needs from storage. SQLite locally (sqliteStore.ts); a Supabase/Postgres
 * version only has to implement these two calls against the table in schema.sql.
 */
export interface Store {
  /** Insert, or overwrite the row with the same (zone, ts). */
  upsert(rows: Row[]): void;
  /** Rows with ts >= `ts`, oldest first. */
  since(ts: number): Row[];
}

/** In-memory store for tests. */
export class MemoryStore implements Store {
  // Key "zone|ts" → row. Using a Map means a second write with the same key replaces the first.
  private rows = new Map<string, Row>();

  upsert(rows: Row[]) {
    for (const r of rows) this.rows.set(`${r.zone}|${r.ts}`, r);
  }

  since(ts: number) {
    return [...this.rows.values()].filter((r) => r.ts >= ts).sort((a, b) => a.ts - b.ts);
  }
}
