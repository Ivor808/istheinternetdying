import { describe, it, expect } from 'vitest';
import {
  formatDate,
  getRangeBounds,
  hasDataAroundAiEra,
  layoutEventLabels,
  monthsInRange,
  rollingMean,
  sliceToRange,
  timeTicks,
  toTs,
  yAxisScale,
} from '@/data/chart';
import { EVENTS, eventId } from '@/data/events';

describe('formatDate', () => {
  it('formats ISO dates in UTC', () => {
    expect(formatDate('2026-03-05')).toBe('Mar 5, 2026');
    expect(formatDate('2024-01-01')).toBe('Jan 1, 2024');
  });
});

describe('getRangeBounds', () => {
  const dates = ['2024-01-01', '2025-12-01', '2026-01-01', '2026-11-16'];

  it('anchors presets to the latest data point', () => {
    expect(getRangeBounds(dates, '30d')).toEqual({ start: '2026-10-17', end: '2026-11-16' });
    expect(getRangeBounds(dates, '1y')).toEqual({ start: '2025-11-16', end: '2026-11-16' });
  });

  it('uses the full history for all and clamps to the first date', () => {
    expect(getRangeBounds(dates, 'all')).toEqual({ start: '2024-01-01', end: '2026-11-16' });
    expect(getRangeBounds(['2026-11-01', '2026-11-16'], '90d')?.start).toBe('2026-11-01');
  });

  it('returns null with no data', () => {
    expect(getRangeBounds([], '1y')).toBeNull();
  });
});

describe('sliceToRange', () => {
  const rows = ['2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01'].map((date) => ({ date }));

  it('keeps one row before the start so lines reach the edge', () => {
    expect(sliceToRange(rows, { start: '2025-11-16', end: '2026-01-01' }).map((r) => r.date)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ]);
  });

  it('does not add a leading row when the start matches exactly', () => {
    expect(sliceToRange(rows, { start: '2025-11-01', end: '2025-12-01' }).map((r) => r.date)).toEqual([
      '2025-11-01',
      '2025-12-01',
    ]);
  });
});

describe('monthsInRange', () => {
  it('keeps monthly buckets that overlap the range', () => {
    const rows = ['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map((date) => ({ date }));
    expect(monthsInRange(rows, { start: '2026-09-20', end: '2026-11-16' }).map((r) => r.date)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
  });
});

describe('yAxisScale', () => {
  it('pins the top at 100 and leaves room below the minimum', () => {
    const { domain, ticks } = yAxisScale([97, 99, 100]);
    expect(domain).toEqual([90, 100]);
    expect(ticks).toEqual([90, 95, 100]);
  });

  it('never clips low values', () => {
    const { domain, ticks } = yAxisScale([88, 42, 99]);
    expect(domain[0]).toBeLessThanOrEqual(42);
    expect(domain[1]).toBe(100);
    expect(ticks[ticks.length - 1]).toBe(100);
    expect(domain[0] % 5).toBe(0);
  });

  it('bottoms out at zero', () => {
    expect(yAxisScale([1]).domain).toEqual([0, 100]);
  });

  it('handles empty input', () => {
    expect(yAxisScale([]).domain).toEqual([90, 100]);
  });
});

describe('timeTicks', () => {
  it('uses month starts for a one year span', () => {
    const ticks = timeTicks(toTs('2025-11-16'), toTs('2026-11-16'));
    expect(ticks[0]).toBe(toTs('2025-12-01'));
    expect(ticks[ticks.length - 1]).toBe(toTs('2026-11-01'));
    expect(ticks).toHaveLength(12);
  });

  it('uses quarter starts for long spans', () => {
    const ticks = timeTicks(toTs('2024-01-01'), toTs('2026-11-16'));
    expect(ticks[0]).toBe(toTs('2024-01-01'));
    expect(ticks[1]).toBe(toTs('2024-04-01'));
  });
});

describe('layoutEventLabels', () => {
  const opts = { rows: 2, charWidth: 6, gap: 8, minX: 0, maxX: 600 };

  it('staggers overlapping labels into a second row', () => {
    const placed = layoutEventLabels(
      [
        { id: 'a', x: 100, text: 'Cloudflare outage', priority: 2 },
        { id: 'b', x: 110, text: 'AWS outage', priority: 1 },
      ],
      opts
    );
    expect(placed.get('a')?.row).toBe(0);
    expect(placed.get('b')?.row).toBe(1);
  });

  it('drops the lowest priority label when rows are full', () => {
    const placed = layoutEventLabels(
      [
        { id: 'a', x: 100, text: 'Label A', priority: 3 },
        { id: 'b', x: 102, text: 'Label B', priority: 2 },
        { id: 'c', x: 104, text: 'Label C', priority: 1 },
      ],
      opts
    );
    expect(placed.has('a')).toBe(true);
    expect(placed.has('b')).toBe(true);
    expect(placed.has('c')).toBe(false);
  });

  it('keeps labels inside the plot horizontally', () => {
    const placed = layoutEventLabels([{ id: 'a', x: 2, text: 'CrowdStrike BSOD', priority: 1 }], opts);
    const label = placed.get('a')!;
    expect(label.cx - label.width / 2).toBeGreaterThanOrEqual(0);
  });
});

describe('EVENTS', () => {
  it('has valid ISO dates and unique ids', () => {
    for (const e of EVENTS) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(toTs(e.date))).toBe(false);
    }
    const ids = EVENTS.map(eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has outage entries with sources', () => {
    const outages = EVENTS.filter((e) => e.category === 'outage');
    expect(outages.length).toBeGreaterThan(5);
    for (const e of outages) expect(e.url).toMatch(/^https:\/\//);
  });
});

describe('rollingMean', () => {
  it('averages the trailing window of calendar days', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'];
    expect(rollingMean(dates, [90, 80, 70, 60], 3)).toEqual([90, 85, 80, 70]);
  });

  it('passes monthly points through unchanged', () => {
    const dates = ['2025-11-01', '2025-12-01', '2026-01-01', '2026-01-02'];
    expect(rollingMean(dates, [90, 80, 70, 100], 7)).toEqual([90, 80, 70, 85]);
  });

  it('skips missing values without leaving gaps in the average', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03'];
    expect(rollingMean(dates, [90, undefined, 70], 7)).toEqual([90, undefined, 80]);
  });
});

describe('hasDataAroundAiEra', () => {
  it('needs data on both sides of the AI Era date', () => {
    expect(hasDataAroundAiEra(['2025-12-01', '2026-03-01'])).toBe(true);
    expect(hasDataAroundAiEra(['2026-09-01', '2026-11-15'])).toBe(false);
    expect(hasDataAroundAiEra(['2025-06-01', '2025-12-31'])).toBe(false);
    expect(hasDataAroundAiEra([])).toBe(false);
  });
});
