-- Postgres / Supabase version of the local SQLite table (see sqliteStore.ts).
-- One row per zone per reading. Counts under 10 arrive as "<10" and are stored as
-- devices = NULL, below_threshold = true — never as a number.
create table if not exists readings (
  zone text not null,
  ts timestamptz not null,
  devices integer,
  below_threshold boolean not null,
  primary key (zone, ts),
  check ((below_threshold and devices is null) or (not below_threshold and devices >= 10))
);
create index if not exists readings_ts on readings (ts);
