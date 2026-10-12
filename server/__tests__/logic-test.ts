/**
 * Tests for the level maths in server/logic.ts. Run with `npm test`.
 *
 * Jest basics: describe() groups tests, it() is one test, expect(x).toBe(y) fails the test if
 * x isn't y. it.each runs the same test for every row of a table.
 */
import { baseline, DAY_MS, levelFromRatio, median, p95, trendOf, typicalDay, WEEK_MS } from '../logic';

describe('p95', () => {
  it('uses the nearest-rank method', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(p95(values)).toBe(95);
    expect(p95([10])).toBe(10);
    expect(p95([30, 10, 20])).toBe(30);
  });

  it('ignores input order and returns null for no data', () => {
    expect(p95([5, 100, 1, 50])).toBe(p95([1, 5, 50, 100]));
    expect(p95([])).toBeNull();
  });
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('levelFromRatio', () => {
  it.each([
    [0, 0],
    [0.349, 0],
    [0.35, 1],
    [0.549, 1],
    [0.55, 2],
    [0.749, 2],
    [0.75, 3],
    [1.4, 3],
  ])('ratio %p → level %p', (r, level) => {
    expect(levelFromRatio(r)).toBe(level);
  });
});

describe('trendOf', () => {
  it('compares against the average of the previous 3 readings', () => {
    expect(trendOf(111, [100, 100, 100])).toBe('up');
    expect(trendOf(110, [100, 100, 100])).toBe('steady'); // exactly +10% is inside the band
    expect(trendOf(90, [100, 100, 100])).toBe('steady');
    expect(trendOf(89, [100, 100, 100])).toBe('down');
  });

  it('only looks at the last 3 previous readings', () => {
    expect(trendOf(100, [1000, 100, 100, 100])).toBe('steady');
  });

  it('is steady with no history, and up from zero', () => {
    expect(trendOf(50, [])).toBe('steady');
    expect(trendOf(50, [0, 0, 0])).toBe('up');
    expect(trendOf(0, [0, 0, 0])).toBe('steady');
  });
});

describe('baseline', () => {
  const at = Date.UTC(2026, 9, 12, 12);

  it('uses p95 of the last 4 weeks once there is a week of history', () => {
    // 100 readings, 5 h apart: ~3 weeks, so past the cold-start week.
    const samples = Array.from({ length: 100 }, (_, i) => ({ ts: at - (i + 1) * 5 * 3600_000, devices: i + 1 }));
    expect(baseline(samples, at)).toBe(95);
  });

  it('ignores readings older than 4 weeks', () => {
    const old = { ts: at - 5 * WEEK_MS, devices: 10_000 };
    const recent = Array.from({ length: 20 }, (_, i) => ({ ts: at - (i + 1) * DAY_MS, devices: 100 }));
    expect(baseline([old, ...recent], at)).toBe(100);
  });

  it('falls back to the max seen so far with under a week of history (cold start)', () => {
    const samples = [
      { ts: at - 2 * DAY_MS, devices: 40 },
      { ts: at - DAY_MS, devices: 300 },
      { ts: at - 3600_000, devices: 80 },
    ];
    expect(baseline(samples, at)).toBe(300);
  });

  it('is null with no usable data', () => {
    expect(baseline([], at)).toBeNull();
    expect(baseline([{ ts: at - DAY_MS, devices: 0 }], at)).toBeNull();
  });
});

describe('typicalDay', () => {
  // Fixed local parts so the test doesn't depend on the machine's time zone.
  const parts = (ts: number) => {
    const d = new Date(ts);
    return { weekday: d.getUTCDay(), hour: d.getUTCHours() };
  };
  const monday = Date.UTC(2026, 9, 12, 23, 30); // Monday, after the last charted hour

  it('takes the median ratio per hour on the same weekday, scaled 0–100', () => {
    const samples = [0, 1, 2].flatMap((w) => [
      { ts: Date.UTC(2026, 9, 12 - 7 * w, 9), devices: [40, 50, 60][w] }, // 9 AM → median 50
      { ts: Date.UTC(2026, 9, 12 - 7 * w, 20), devices: 200 }, // capped at 100
      { ts: Date.UTC(2026, 9, 11 - 7 * w, 9), devices: 100 }, // Sunday: ignored
    ]);
    const curve = typicalDay(samples, 100, monday, parts);
    expect(curve).toHaveLength(17);
    expect(curve[9 - 7]).toBe(50);
    expect(curve[20 - 7]).toBe(100);
    expect(curve[8 - 7]).toBe(0); // no readings that hour
  });

  it('ignores readings older than 8 weeks', () => {
    const samples = [{ ts: Date.UTC(2026, 9, 12 - 7 * 9, 9), devices: 90 }];
    expect(typicalDay(samples, 100, monday, parts)[2]).toBe(0);
  });
});
