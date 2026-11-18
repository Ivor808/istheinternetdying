import { describe, it, expect } from 'vitest';
import {
  COVERAGE_THRESHOLD,
  TRAILING_RECOMPUTE_DAYS,
  datesToScore,
  firstCoverableDate,
  isIndexCovered,
  isProviderCovered,
  scoreDate,
  toDateStr,
  updateCoverage,
  type ScoringProvider,
} from '../../src/scoring/daily-index';

const d = (s: string) => new Date(s);

describe('isProviderCovered', () => {
  // Window for 2026-03-15 is Mar 9 00:00 to Mar 16 00:00
  const date = d('2026-03-15T00:00:00Z');

  it('is covered when data starts by the window start and was fetched after it ended', () => {
    expect(
      isProviderCovered({ coverageStart: d('2026-03-09T00:00:00Z'), lastFetchedAt: d('2026-03-16T00:30:00Z') }, date)
    ).toBe(true);
  });

  it('is not covered when data starts inside the window', () => {
    expect(
      isProviderCovered({ coverageStart: d('2026-03-09T00:00:01Z'), lastFetchedAt: d('2026-03-20T00:00:00Z') }, date)
    ).toBe(false);
  });

  it('is not covered until the scored day has ended and been fetched', () => {
    expect(
      isProviderCovered({ coverageStart: d('2026-01-01T00:00:00Z'), lastFetchedAt: d('2026-03-15T23:00:00Z') }, date)
    ).toBe(false);
  });

  it('is not covered without coverage data', () => {
    expect(isProviderCovered({ coverageStart: null, lastFetchedAt: null }, date)).toBe(false);
  });
});

describe('updateCoverage', () => {
  const fetchedAt = d('2026-03-20T00:30:00Z');

  it('starts coverage at the oldest listed incident on the first fetch', () => {
    expect(updateCoverage({ coverageStart: null, lastFetchedAt: null }, d('2026-01-05T00:00:00Z'), fetchedAt)).toEqual({
      coverageStart: d('2026-01-05T00:00:00Z'),
      lastFetchedAt: fetchedAt,
    });
  });

  it('keeps the earlier start when the feed overlaps the previous fetch', () => {
    const prev = { coverageStart: d('2026-01-05T00:00:00Z'), lastFetchedAt: d('2026-03-19T00:30:00Z') };
    expect(updateCoverage(prev, d('2026-02-01T00:00:00Z'), fetchedAt).coverageStart).toEqual(
      d('2026-01-05T00:00:00Z')
    );
  });

  it('restarts coverage when incidents may have scrolled off the feed since the last fetch', () => {
    const prev = { coverageStart: d('2026-01-05T00:00:00Z'), lastFetchedAt: d('2026-02-01T00:00:00Z') };
    // Oldest listed is newer than our last fetch: there's a gap we can't see
    expect(updateCoverage(prev, d('2026-02-10T00:00:00Z'), fetchedAt).coverageStart).toEqual(
      d('2026-02-10T00:00:00Z')
    );
  });

  it('an empty feed on the first fetch only proves the present', () => {
    expect(updateCoverage({ coverageStart: null, lastFetchedAt: null }, null, fetchedAt).coverageStart).toEqual(
      fetchedAt
    );
  });

  it('an empty feed keeps existing coverage', () => {
    const prev = { coverageStart: d('2026-01-05T00:00:00Z'), lastFetchedAt: d('2026-03-19T00:30:00Z') };
    expect(updateCoverage(prev, null, fetchedAt).coverageStart).toEqual(d('2026-01-05T00:00:00Z'));
  });
});

describe('scoreDate', () => {
  const covered = { coverageStart: d('2026-01-01T00:00:00Z'), lastFetchedAt: d('2026-03-16T00:30:00Z') };
  const date = d('2026-03-15T00:00:00Z');

  it('counts incidents that start during the scored day (scored at end of day)', () => {
    const providers: ScoringProvider[] = [
      {
        id: 1,
        category: 'ai',
        ...covered,
        incidents: [
          // 4h major late on the scored day: day score 40
          { severity: 'major', startedAt: d('2026-03-15T18:00:00Z'), resolvedAt: d('2026-03-15T22:00:00Z') },
        ],
      },
    ];
    const result = scoreDate(providers, date);
    expect(result.providerScores[0].score).toBeCloseTo((6 * 100 + 40) / 7);
    expect(result.globalScore).toBeCloseTo((6 * 100 + 40) / 7);
  });

  it('ignores incidents after the scored day', () => {
    const providers: ScoringProvider[] = [
      {
        id: 1,
        category: 'ai',
        ...covered,
        incidents: [
          { severity: 'critical', startedAt: d('2026-03-16T01:00:00Z'), resolvedAt: d('2026-03-16T05:00:00Z') },
        ],
      },
    ];
    expect(scoreDate(providers, date).globalScore).toBe(100);
  });

  it('leaves uncovered providers out and reports coverage', () => {
    const providers: ScoringProvider[] = [
      { id: 1, category: 'ai', ...covered, incidents: [] },
      { id: 2, category: 'ai', coverageStart: d('2026-03-12T00:00:00Z'), lastFetchedAt: covered.lastFetchedAt,
        incidents: [{ severity: 'critical', startedAt: d('2026-03-14T00:00:00Z'), resolvedAt: d('2026-03-14T12:00:00Z') }] },
      { id: 3, category: 'fintech', coverageStart: null, lastFetchedAt: null, incidents: [] },
    ];
    const result = scoreDate(providers, date);
    expect(result.providerScores.map((p) => p.providerId)).toEqual([1]);
    expect(result.categoryScores).toEqual({ ai: 100 });
    expect(result.coveredProviders).toBe(1);
    expect(result.totalProviders).toBe(3);
  });

  it('has no global score when nothing is covered', () => {
    const result = scoreDate([{ id: 1, category: 'ai', coverageStart: null, lastFetchedAt: null, incidents: [] }], date);
    expect(result.globalScore).toBeNull();
    expect(result.coveredProviders).toBe(0);
  });
});

describe('isIndexCovered', () => {
  it(`requires at least ${COVERAGE_THRESHOLD * 100}% of providers`, () => {
    expect(isIndexCovered({ coveredProviders: 40, totalProviders: 50 })).toBe(true);
    expect(isIndexCovered({ coveredProviders: 39, totalProviders: 50 })).toBe(false);
  });

  it('rejects rows from before coverage was recorded', () => {
    expect(isIndexCovered({ coveredProviders: null, totalProviders: null })).toBe(false);
  });
});

describe('firstCoverableDate', () => {
  it('is the end of the first window that enough providers fully cover', () => {
    const providers = [
      { coverageStart: d('2026-01-01T00:00:00Z'), lastFetchedAt: null },
      { coverageStart: d('2026-02-01T00:00:00Z'), lastFetchedAt: null },
      { coverageStart: d('2026-03-01T12:00:00Z'), lastFetchedAt: null },
      { coverageStart: d('2026-03-05T00:00:00Z'), lastFetchedAt: null },
      { coverageStart: null, lastFetchedAt: null },
    ];
    // 80% of 5 = 4 providers; the 4th starts Mar 5, so the first window is Mar 5–11
    expect(toDateStr(firstCoverableDate(providers)!)).toBe('2026-03-11');
  });

  it('rounds a mid-day coverage start up to the next full day', () => {
    const providers = [{ coverageStart: d('2026-03-01T12:00:00Z'), lastFetchedAt: null }];
    expect(toDateStr(firstCoverableDate(providers)!)).toBe('2026-03-08');
  });

  it('is null when too few providers have coverage', () => {
    expect(firstCoverableDate([{ coverageStart: null, lastFetchedAt: null }])).toBeNull();
  });
});

describe('datesToScore', () => {
  const now = d('2026-03-20T00:30:00Z');

  it('rescores the trailing completed days and never today', () => {
    const dates = datesToScore(now, [], new Set()).map(toDateStr);
    expect(dates).toHaveLength(TRAILING_RECOMPUTE_DAYS);
    expect(dates[0]).toBe('2026-03-12');
    expect(dates[dates.length - 1]).toBe('2026-03-19');
    expect(dates).not.toContain('2026-03-20');
  });

  it('rescores trailing days even if they were already scored', () => {
    const scored = new Set(['2026-03-18', '2026-03-19']);
    expect(datesToScore(now, [], scored).map(toDateStr)).toContain('2026-03-19');
  });

  it('fills earlier coverable days that have no coverage-aware row yet', () => {
    const providers = [{ coverageStart: d('2026-03-01T00:00:00Z'), lastFetchedAt: now }];
    const scored = new Set(['2026-03-07', '2026-03-08']);
    const dates = datesToScore(now, providers, scored).map(toDateStr);
    // Coverable from Mar 7 (window Mar 1–7); Mar 7–8 are done, Mar 9 onwards needed
    expect(dates[0]).toBe('2026-03-09');
    expect(dates).not.toContain('2026-03-07');
    expect(dates).not.toContain('2026-03-06');
    expect(dates[dates.length - 1]).toBe('2026-03-19');
  });
});
