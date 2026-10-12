/**
 * Tests for GET /occupancy (server/snapshot.ts): readings go in through the real ingest
 * handler, into an in-memory store, and we check the buildings that come out.
 */
import { handleIngest } from '../ingest';
import { DAY_MS } from '../logic';
import { buildSnapshot } from '../snapshot';
import { MemoryStore, type Row } from '../store';

const KEY = 'test-key';
const at = new Date(2026, 9, 12, 14, 0).getTime(); // Monday 2 PM local
const ts = new Date(at).toISOString();

function ingest(store: MemoryStore, timestamp: string, zones: { zone: string; devices: number | '<10' }[]) {
  return handleIngest(store, KEY, KEY, JSON.stringify({ timestamp, zones }));
}
const weldon = (s: ReturnType<typeof buildSnapshot>) => s.buildings.find((b) => b.id === 'weldon')!;

describe('buildSnapshot', () => {
  it('returns every building, with "nodata" for ones with no reading', () => {
    const store = new MemoryStore();
    ingest(store, ts, [{ zone: 'weldon-f1', devices: 100 }]);
    const snap = buildSnapshot(store, at);
    expect(snap.updatedAt).toBe(at);
    expect(snap.buildings.length).toBeGreaterThan(20);
    expect(snap.buildings.find((b) => b.id === 'ssc')?.status).toBe('nodata');
    expect(weldon(snap).status).toBe('live');
  });

  it('sums floors for the building level and marks missing floors as no data', () => {
    const store = new MemoryStore();
    // A week+ of history where Weldon peaks at 500 in total.
    const history: Row[] = [];
    for (let d = 1; d <= 10; d++) history.push({ zone: 'weldon-f1', ts: at - d * DAY_MS, devices: 500, belowThreshold: false });
    store.upsert(history);
    ingest(store, ts, [
      { zone: 'weldon-f1', devices: 200 },
      { zone: 'weldon-f2', devices: 200 },
      { zone: 'weldon-f4', devices: '<10' },
    ]);
    const b = weldon(buildSnapshot(store, at));
    expect(b.status).toBe('live');
    expect(b.level).toBe(3); // 400 / p95(500, 500, …, 400) = 0.8 → Very Busy
    expect(b.floors?.map((f) => f.status ?? 'live')).toEqual(['live', 'live', 'nodata', 'low', 'nodata']);
  });

  it('shows a building as low activity when every zone is "<10"', () => {
    const store = new MemoryStore();
    ingest(store, ts, [
      { zone: 'weldon-f1', devices: '<10' },
      { zone: 'weldon-f2', devices: '<10' },
    ]);
    expect(weldon(buildSnapshot(store, at)).status).toBe('low');
  });

  it('computes the trend from the previous 3 readings', () => {
    const store = new MemoryStore();
    for (const [minsAgo, n] of [[45, 100], [30, 100], [15, 100], [0, 150]] as const)
      ingest(store, new Date(at - minsAgo * 60_000).toISOString(), [{ zone: 'weldon-f1', devices: n }]);
    expect(weldon(buildSnapshot(store, at)).trend).toBe('up');
  });

  it('includes a 17-hour typicalDay', () => {
    const store = new MemoryStore();
    ingest(store, ts, [{ zone: 'weldon-f1', devices: 100 }]);
    expect(weldon(buildSnapshot(store, at)).typicalDay).toHaveLength(17);
  });

  it('can be evaluated as of an earlier time', () => {
    const store = new MemoryStore();
    ingest(store, ts, [{ zone: 'weldon-f1', devices: 100 }]);
    ingest(store, new Date(at + 3600_000).toISOString(), [{ zone: 'ssc-main', devices: 100 }]);
    const snap = buildSnapshot(store, at);
    expect(snap.updatedAt).toBe(at);
    expect(weldon(snap).status).toBe('live');
  });
});
