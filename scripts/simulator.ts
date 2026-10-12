/**
 * Stands in for Western ITS: posts fake zone counts to the backend.
 *
 *   npm run sim -- --once
 *   npm run sim -- --live --interval=10s
 *   npm run sim:backfill                        (6 weeks of 15-minute history)
 *   npm run sim -- --once --dry-run
 *   npm run sim -- --scenario=bad-key
 *
 * Reads API_URL (default http://localhost:4000) and INGEST_KEY from .env.local. See TESTING.md.
 *
 * This file is just the command-line wrapper: it reads the flags, then uses scripts/sim/core.ts
 * to build readings and POSTs them to the server with fetch().
 */
import { buildPayload, parseDuration, scenarioRequests, SCENARIOS, MISSING_ZONE, type Payload, type Scenario } from './sim/core';

/** Backfill readings are 15 minutes apart, like the real feed. */
const STEP_MS = 15 * 60 * 1000;
/** How many backfill requests are in flight at once (faster than one at a time). */
const BACKFILL_CONCURRENCY = 8;

// --- Command-line flags --------------------------------------------------------------------
// "--interval=10s --live" → Map { 'interval' → '10s', 'live' → 'true' }
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'] as const;
  }),
);
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const KEY = process.env.INGEST_KEY ?? '';
const dryRun = args.has('dry-run');
const scenario = args.get('scenario') as Scenario | undefined;

if (scenario && !SCENARIOS.includes(scenario)) fatal(`Unknown scenario "${scenario}". Choose one of: ${SCENARIOS.join(', ')}`);
if (!KEY && !dryRun) fatal('INGEST_KEY is not set. Add it to .env.local (see TESTING.md), or use --dry-run.');

/** Send one reading to POST /ingest (or just print it with --dry-run). */
async function post(body: string, key = KEY): Promise<{ status: number; text: string }> {
  if (dryRun) {
    console.log(body);
    return { status: 0, text: '' };
  }
  const res = await fetch(`${API_URL}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ingest-key': key },
    body,
  });
  return { status: res.status, text: await res.text() };
}

/** The reading for "now", with missing-zone / all-below-threshold applied. */
function reading(at: Date): Payload {
  return buildPayload(at, Math.random, {
    drop: scenario === 'missing-zone' ? [MISSING_ZONE] : undefined,
    allBelow: scenario === 'all-below-threshold',
  });
}

/** --once: build and send one reading for now, and print the server's answer. */
async function sendOne(at = new Date()) {
  const p = reading(at);
  const r = await post(JSON.stringify(p));
  if (!dryRun) console.log(`${p.timestamp}  ${p.zones.length} zones  → ${r.status} ${r.text}`);
  if (!dryRun && r.status !== 200) process.exitCode = 1;
}

/** --live: send a reading, wait, repeat — until you press Ctrl+C. */
async function live(intervalMs: number) {
  console.log(`Sending every ${intervalMs / 1000}s to ${API_URL}. Ctrl+C to stop.`);
  for (;;) {
    await sendOne().catch((e) => console.error(`Send failed: ${e.message}`));
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * --backfill=6w: fake history, one reading every 15 minutes from 6 weeks ago until now, so the
 * server has enough data for p95 baselines and typical-day curves straight away.
 */
async function backfill(spanMs: number) {
  // Round "now" down to a quarter hour so timestamps look like :00, :15, :30, :45.
  const end = Math.floor(Date.now() / STEP_MS) * STEP_MS;
  const times: Date[] = [];
  for (let t = end - spanMs; t <= end; t += STEP_MS) times.push(new Date(t));
  const payloads = times.map((t) => reading(t)).filter((p) => p.zones.length > 0);
  console.log(`Backfilling ${payloads.length} readings (${times[0].toISOString()} → ${times.at(-1)!.toISOString()}) to ${API_URL}`);
  if (dryRun) {
    console.log(JSON.stringify(payloads[0]));
    console.log(`… ${payloads.length - 2} more …`);
    console.log(JSON.stringify(payloads.at(-1)));
    return;
  }
  let done = 0;
  let failed = 0;
  // Several "workers" share one queue; each takes the next reading until the queue is empty.
  const queue = [...payloads];
  await Promise.all(
    Array.from({ length: BACKFILL_CONCURRENCY }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const r = await post(JSON.stringify(p));
        if (r.status !== 200) failed++;
        if (++done % 500 === 0) console.log(`  ${done}/${payloads.length}`);
      }
    }),
  );
  console.log(`Done: ${done - failed} stored, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

/** Scenarios that are about the request itself: send them once and check the status codes. */
async function runScenario(name: Scenario) {
  console.log(`Scenario ${name} → ${API_URL}`);
  for (const r of scenarioRequests(name, new Date(), Math.random, KEY)) {
    const res = await post(r.body, r.key);
    if (dryRun) continue;
    const pass = res.status === r.expect;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${r.label}: got ${res.status}, expected ${r.expect}  ${res.text}`);
    if (!pass) process.exitCode = 1;
  }
  if (name === 'stale') console.log('  Now stop sending. The app should show "Data may be out of date".');
}

/** Print an error and stop. */
function fatal(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/** Pick the mode from the flags. No mode flag = --once. */
async function main() {
  if (args.has('backfill')) return backfill(parseDuration(args.get('backfill')!));
  if (args.has('live')) {
    if (scenario && !['missing-zone', 'all-below-threshold'].includes(scenario))
      fatal('--live only combines with --scenario=missing-zone or all-below-threshold');
    return live(parseDuration(args.get('interval') ?? '15m'));
  }
  if (scenario && !['missing-zone', 'all-below-threshold'].includes(scenario)) return runScenario(scenario);
  return sendOne();
}

main().catch((e) => fatal(e instanceof Error ? e.message : String(e)));
