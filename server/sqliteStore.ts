/**
 * SQLITE STORE — saves readings in a local database file (server/data/occupied.db by default).
 *
 * Uses Node's built-in `node:sqlite` module (Node 22.5+), so nothing needs installing or
 * compiling. SQLite is a whole database in a single file — perfect for local testing.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Row, Store } from './store';

/**
 * SQLite version of schema.sql. ts is stored as ISO 8601 UTC text (sorts correctly, and maps
 * straight onto TIMESTAMPTZ); below_threshold is 0/1.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS readings (
  zone TEXT NOT NULL,
  ts TEXT NOT NULL,
  devices INTEGER,
  below_threshold INTEGER NOT NULL,
  PRIMARY KEY (zone, ts),
  CHECK ((below_threshold = 1 AND devices IS NULL) OR (below_threshold = 0 AND devices >= 10))
);
CREATE INDEX IF NOT EXISTS readings_ts ON readings (ts);
`;

/** A row as SQLite returns it (snake_case column names, 0/1 instead of true/false). */
type DbRow = { zone: string; ts: string; devices: number | null; below_threshold: number };

export class SqliteStore implements Store {
  private db: DatabaseSync;

  constructor(path: string) {
    // Create the folder if needed (":memory:" is a special name for a temporary in-memory DB).
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    // WAL mode: reads (GET /occupancy) don't block writes (POST /ingest) and vice versa.
    this.db.exec('PRAGMA journal_mode = WAL;');
    // Create the table if it doesn't exist yet.
    this.db.exec(SCHEMA);
  }

  upsert(rows: Row[]) {
    // "Upsert" = insert, or if (zone, ts) already exists, update it instead.
    // The ? marks are filled in by stmt.run(...) — never build SQL by pasting values into the
    // string, which would allow SQL injection.
    const stmt = this.db.prepare(
      `INSERT INTO readings (zone, ts, devices, below_threshold) VALUES (?, ?, ?, ?)
       ON CONFLICT (zone, ts) DO UPDATE SET devices = excluded.devices, below_threshold = excluded.below_threshold`,
    );
    // One transaction for the whole batch: either every row is saved, or none are.
    this.db.exec('BEGIN');
    try {
      for (const r of rows) stmt.run(r.zone, new Date(r.ts).toISOString(), r.devices, r.belowThreshold ? 1 : 0);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  since(ts: number) {
    const rows = this.db
      .prepare('SELECT zone, ts, devices, below_threshold FROM readings WHERE ts >= ? ORDER BY ts')
      .all(new Date(ts).toISOString()) as DbRow[];
    // Convert database rows back into the Row shape the rest of the server uses.
    return rows.map((r) => ({
      zone: r.zone,
      ts: Date.parse(r.ts),
      devices: r.devices,
      belowThreshold: r.below_threshold === 1,
    }));
  }
}
