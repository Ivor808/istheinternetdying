import { describe, it, expect } from 'vitest';
import { computeDayStats, computeSingleDayScore, computeRollingScore } from '../../src/scoring/provider-score';

describe('computeSingleDayScore', () => {
  const day = new Date('2026-03-15');

  it('returns 100 when there are no incidents', () => {
    expect(computeSingleDayScore([], day)).toBe(100);
  });

  it('deducts 5 points per hour for minor incidents', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'),
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(90);
  });

  it('deducts 15 points per hour for major incidents', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'),
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(70);
  });

  it('deducts 30 points per hour for critical incidents', () => {
    const incidents = [
      {
        severity: 'critical' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'),
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(40);
  });

  it('floors at 0', () => {
    const incidents = [
      {
        severity: 'critical' as const,
        startedAt: new Date('2026-03-15T00:00:00Z'),
        resolvedAt: new Date('2026-03-15T23:59:59Z'),
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(0);
  });

  it('only counts hours that overlap with the given day', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-14T20:00:00Z'),
        resolvedAt: new Date('2026-03-15T02:00:00Z'),
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(90);
  });

  it('treats unresolved incidents as ongoing until end of day', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T20:00:00Z'),
        resolvedAt: null,
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(40);
  });

  // Severity envelope tests
  it('overlapping minor incidents score the same as one minor (envelope)', () => {
    const single = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T14:00:00Z'),
      },
    ];
    const multiple = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'),
      },
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:30:00Z'),
        resolvedAt: new Date('2026-03-15T13:00:00Z'),
      },
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T11:00:00Z'),
        resolvedAt: new Date('2026-03-15T14:00:00Z'),
      },
    ];
    expect(computeSingleDayScore(single, day)).toBe(
      computeSingleDayScore(multiple, day)
    );
  });

  it('overlapping minor + major uses major for overlap period', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T14:00:00Z'), // 4h minor
      },
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T12:00:00Z'),
        resolvedAt: new Date('2026-03-15T13:00:00Z'), // 1h major overlap
      },
    ];
    // 10-12: 2h minor = 10, 12-13: 1h major = 15, 13-14: 1h minor = 5 → total 30
    // 100 - 30 = 70
    expect(computeSingleDayScore(incidents, day)).toBe(70);
  });

  it('non-overlapping incidents both count fully', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T08:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:00Z'), // 2h
      },
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T14:00:00Z'),
        resolvedAt: new Date('2026-03-15T16:00:00Z'), // 2h
      },
    ];
    // 4h minor total = 20 deduction
    expect(computeSingleDayScore(incidents, day)).toBe(80);
  });

  // Duration cap tests
  it('caps minor incidents at 7 days — day 8 is unaffected', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        // Started 10 days before our test day, never resolved
        startedAt: new Date('2026-03-05T00:00:00Z'),
        resolvedAt: null,
      },
    ];
    // 7-day cap from Mar 5 = effective end Mar 12
    // Our test day is Mar 15 — outside the cap, so no impact
    expect(computeSingleDayScore(incidents, day)).toBe(100);
  });

  it('caps critical incidents at 3 days — day 4 is unaffected', () => {
    const incidents = [
      {
        severity: 'critical' as const,
        startedAt: new Date('2026-03-11T00:00:00Z'),
        resolvedAt: null,
      },
    ];
    // 3-day cap from Mar 11 = effective end Mar 14
    // Our test day is Mar 15 — outside the cap
    expect(computeSingleDayScore(incidents, day)).toBe(100);
  });

  it('stale unresolved minor still affects days within the cap window', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-14T00:00:00Z'),
        resolvedAt: null,
      },
    ];
    // Started Mar 14, cap = 7 days so effective end Mar 21
    // Mar 15 is within cap — full 24h of minor = 100 - (5*24) = -20, floored at 70
    expect(computeSingleDayScore(incidents, day)).toBe(70);
  });

  // Severity floor tests
  it('a day that never exceeds minor cannot go below 70', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T00:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:00:00Z'), // 10h = 50 pts
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(70);
  });

  it('a day that never exceeds major cannot go below 40', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T00:00:00Z'),
        resolvedAt: new Date('2026-03-15T06:00:00Z'), // 6h = 90 pts
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(40);
  });

  it('a long minor plus a short major is floored at the major level', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T00:00:00Z'),
        resolvedAt: new Date('2026-03-16T00:00:00Z'),
      },
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T12:00:00Z'),
        resolvedAt: new Date('2026-03-15T13:00:00Z'),
      },
    ];
    // 23h minor (115) + 1h major (15) = 130 → floor 40
    expect(computeSingleDayScore(incidents, day)).toBe(40);
  });

  it('a critical day can reach 0', () => {
    const incidents = [
      {
        severity: 'critical' as const,
        startedAt: new Date('2026-03-15T08:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'), // 4h = 120 pts
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBe(0);
  });

  it('keeps fractional deductions instead of rounding', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T10:06:00Z'), // 0.1h = 0.5 pts
      },
    ];
    expect(computeSingleDayScore(incidents, day)).toBeCloseTo(99.5);
  });
});

describe('computeRollingScore', () => {
  it('averages 7 days of scores', () => {
    const result = computeRollingScore([], new Date('2026-03-15'));
    expect(result).toBe(100);
  });

  it('reflects a single incident across the window', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-12T10:00:00Z'),
        resolvedAt: new Date('2026-03-12T14:00:00Z'),
      },
    ];
    const result = computeRollingScore(incidents, new Date('2026-03-15'));
    // (6 × 100 + 40) / 7, unrounded
    expect(result).toBeCloseTo(640 / 7);
  });
});

describe('computeDayStats', () => {
  const day = new Date('2026-03-10T00:00:00Z');

  it('reports degraded hours and worst severity alongside the score', () => {
    const incidents = [
      { severity: 'minor' as const, startedAt: new Date('2026-03-10T01:00:00Z'), resolvedAt: new Date('2026-03-10T04:00:00Z') },
      { severity: 'major' as const, startedAt: new Date('2026-03-10T02:00:00Z'), resolvedAt: new Date('2026-03-10T03:00:00Z') },
    ];
    // 2h minor (10 pts) + 1h major (15 pts); 3h degraded in total
    expect(computeDayStats(incidents, day)).toEqual({ score: 75, hours: 3, worst: 2 });
  });

  it('cuts open incidents off at `until`', () => {
    const incidents = [
      { severity: 'minor' as const, startedAt: new Date('2026-03-10T08:00:00Z'), resolvedAt: null },
    ];
    expect(computeDayStats(incidents, day, new Date('2026-03-10T10:00:00Z')).hours).toBe(2);
    expect(computeDayStats(incidents, day).hours).toBe(16);
  });

  it('applies the same severity floor as the day score', () => {
    const incidents = [
      { severity: 'minor' as const, startedAt: new Date('2026-03-10T00:00:00Z'), resolvedAt: null },
    ];
    const stats = computeDayStats(incidents, day);
    expect(stats).toEqual({ score: 70, hours: 24, worst: 1 });
    expect(computeSingleDayScore(incidents, day)).toBe(stats.score);
  });
});
