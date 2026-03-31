import { describe, it, expect } from 'vitest';
import { computeSingleDayScore, computeRollingScore } from '../../src/scoring/provider-score';

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
    expect(result).toBe(91);
  });
});
