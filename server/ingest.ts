/**
 * INGEST — handles POST /ingest, where ITS (or the simulator) sends device counts.
 *
 * Steps for every request:
 *   1. Check the x-ingest-key header matches INGEST_KEY → otherwise 401 Unauthorized.
 *   2. Parse the JSON and validate it strictly → otherwise 400 Bad Request.
 *   3. Save the rows (upsert). Nothing else — all the level maths happens on GET /occupancy.
 *
 * Privacy is enforced here: only a zone id and an aggregate count are accepted. Counts under
 * 10 must arrive as "<10", and any extra field (e.g. a MAC address) gets the whole payload
 * rejected, so identifying data can never end up in the database.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { ZONES } from '../src/data/buildings';

import { MIN_COUNT } from './logic';
import type { Row, Store } from './store';

/** What ITS posts. Counts under 10 must arrive as the string "<10". */
export type IngestPayload = {
  timestamp: string;
  zones: { zone: string; devices: number | '<10' }[];
};

export type HttpResult = { status: number; body: Record<string, unknown> };

/** Every zone id the app knows about (from src/data/buildings.ts). A Set makes lookups fast. */
const KNOWN_ZONES = new Set(ZONES.map((z) => z.id));
/** ISO 8601 in UTC, e.g. 2026-10-12T14:15:00Z or 2026-10-12T14:15:00.000Z */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Result of validation: either the rows to save, or an error message. */
type Parsed = { ok: true; rows: Row[]; ignored: string[] } | { ok: false; error: string };

/**
 * Strict validation. Anything that could carry more than an aggregate count (extra fields such as
 * MAC addresses or access-point ids, raw counts under 10) is rejected outright. Zones the app
 * doesn't know about (e.g. residences) are dropped and listed in `ignored`.
 */
export function parsePayload(body: unknown): Parsed {
  // --- The top level: exactly { timestamp, zones } ---
  if (!isObject(body)) return fail('Body must be a JSON object');
  const extra = Object.keys(body).filter((k) => k !== 'timestamp' && k !== 'zones');
  if (extra.length) return fail(`Unexpected field(s): ${extra.join(', ')}`);
  const { timestamp, zones } = body;
  if (typeof timestamp !== 'string' || !ISO_UTC.test(timestamp) || Number.isNaN(Date.parse(timestamp)))
    return fail('timestamp must be ISO 8601 UTC, e.g. 2026-10-12T14:15:00Z');
  if (!Array.isArray(zones)) return fail('zones must be an array');

  // --- Each zone entry ---
  const ts = Date.parse(timestamp);
  const rows: Row[] = [];
  const ignored: string[] = [];
  const seen = new Set<string>();
  for (const [i, z] of zones.entries()) {
    if (!isObject(z)) return fail(`zones[${i}] must be an object`);
    const keys = Object.keys(z).filter((k) => k !== 'zone' && k !== 'devices');
    if (keys.length) return fail(`zones[${i}] has unexpected field(s): ${keys.join(', ')}`);
    if (typeof z.zone !== 'string' || !z.zone) return fail(`zones[${i}].zone must be a string`);
    if (seen.has(z.zone)) return fail(`zone ${z.zone} appears twice`);
    seen.add(z.zone);
    // devices must be "<10" or a whole number >= 10 (raw small counts could identify people).
    const d = z.devices;
    const below = d === '<10';
    if (!below && !(Number.isInteger(d) && (d as number) >= MIN_COUNT))
      return fail(`zones[${i}].devices must be an integer >= ${MIN_COUNT} or "<10"`);
    // Unknown zone (e.g. a residence): skip it, but report it so mismatched ids are noticed.
    if (!KNOWN_ZONES.has(z.zone)) {
      ignored.push(z.zone);
      continue;
    }
    rows.push({ zone: z.zone, ts, devices: below ? null : (d as number), belowThreshold: below });
  }
  return { ok: true, rows, ignored };
}

/** POST /ingest: check the key, validate, upsert. Nothing else. */
export function handleIngest(
  store: Store,
  expectedKey: string,
  providedKey: string | undefined,
  rawBody: string,
): HttpResult {
  if (!providedKey || !sameSecret(providedKey, expectedKey)) return { status: 401, body: { error: 'Invalid ingest key' } };
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Body is not valid JSON' } };
  }
  const parsed = parsePayload(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  store.upsert(parsed.rows);
  return { status: 200, body: { stored: parsed.rows.length, ignored: parsed.ignored } };
}

/**
 * Constant-time comparison (hashing first makes the lengths equal).
 * A normal === stops at the first wrong character, so an attacker could time responses to
 * guess the key one character at a time. timingSafeEqual always takes the same time.
 */
function sameSecret(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/** True for a plain object like { … } (not null, not an array). */
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const fail = (error: string) => ({ ok: false as const, error });
