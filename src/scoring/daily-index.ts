import { computeRollingScore } from './provider-score';
import { computeCategoryScores, computeGlobalIndex } from './aggregation';

const DAY_MS = 24 * 60 * 60 * 1000;

// Days in the rolling window, ending on (and including) the scored date
export const WINDOW_DAYS = 7;

/**
 * Share of providers that must have complete incident data for a date before
 * that date's index is shown. Below this the index would mostly reflect
 * "no data" rather than "no outages".
 */
export const COVERAGE_THRESHOLD = 0.8;

/**
 * Completed days rescored on every run. The window is 7 days and an extra day
 * absorbs a missed run, so late resolutions and reclassifications on the
 * status page reach every day whose window they touch.
 */
export const TRAILING_RECOMPUTE_DAYS = WINDOW_DAYS + 1;

export interface ProviderCoverage {
  // Incident data is complete from this moment (see updateCoverage)
  coverageStart: Date | null;
  // Last successful fetch of the provider's feed
  lastFetchedAt: Date | null;
}

export interface ScoringIncident {
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
}

export interface ScoringProvider extends ProviderCoverage {
  id: number;
  category: string;
  incidents: ScoringIncident[];
}

export interface DateScore {
  // Only covered providers are scored
  providerScores: Array<{ providerId: number; score: number }>;
  categoryScores: Record<string, number>;
  // Null when no provider is covered
  globalScore: number | null;
  coveredProviders: number;
  totalProviders: number;
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// [start, end) of the rolling window for a scored date
export function windowFor(date: Date): { start: Date; end: Date } {
  const day = startOfUtcDay(date);
  return {
    start: new Date(day.getTime() - (WINDOW_DAYS - 1) * DAY_MS),
    end: new Date(day.getTime() + DAY_MS),
  };
}

/**
 * A provider covers a date when its stored incidents are complete for the
 * whole window: complete since on/before the window starts, and fetched
 * after the window ended (so nothing from the last day is missing).
 */
export function isProviderCovered(p: ProviderCoverage, date: Date): boolean {
  if (!p.coverageStart || !p.lastFetchedAt) return false;
  const { start, end } = windowFor(date);
  return p.coverageStart <= start && p.lastFetchedAt >= end;
}

/**
 * New coverage after a successful fetch. The feed only lists the most recent
 * incidents, so a fetch proves completeness from its oldest listed incident
 * onwards. Coverage keeps extending back as long as consecutive fetches
 * overlap; if the oldest listed incident is newer than our previous fetch,
 * incidents may have scrolled off in between, so coverage restarts.
 */
export function updateCoverage(
  prev: ProviderCoverage,
  oldestListedAt: Date | null,
  fetchedAt: Date
): ProviderCoverage {
  // An empty feed means no incidents exist, so nothing was missed since the
  // last fetch; on a first fetch we still only claim the present
  if (oldestListedAt === null) {
    return { coverageStart: prev.coverageStart ?? fetchedAt, lastFetchedAt: fetchedAt };
  }
  const proven = oldestListedAt;
  const overlaps =
    prev.coverageStart !== null &&
    prev.lastFetchedAt !== null &&
    proven <= prev.lastFetchedAt;
  const coverageStart =
    overlaps && prev.coverageStart! < proven ? prev.coverageStart : proven;
  return { coverageStart, lastFetchedAt: fetchedAt };
}

export function scoreDate(providers: ScoringProvider[], date: Date): DateScore {
  const { end } = windowFor(date);
  const day = startOfUtcDay(date);
  const providerScores: DateScore['providerScores'] = [];
  const entries: Array<{ category: string; score: number }> = [];

  for (const p of providers) {
    if (!isProviderCovered(p, date)) continue;
    const relevant = p.incidents.filter((i) => i.startedAt < end);
    const score = computeRollingScore(relevant, day);
    providerScores.push({ providerId: p.id, score });
    entries.push({ category: p.category, score });
  }

  const categoryScores = computeCategoryScores(entries);
  return {
    providerScores,
    categoryScores,
    globalScore: entries.length > 0 ? computeGlobalIndex(categoryScores) : null,
    coveredProviders: entries.length,
    totalProviders: providers.length,
  };
}

export function isIndexCovered(row: {
  coveredProviders: number | null;
  totalProviders: number | null;
}): boolean {
  if (row.coveredProviders === null || !row.totalProviders) return false;
  return row.coveredProviders >= row.totalProviders * COVERAGE_THRESHOLD;
}

/**
 * First date whose window could reach the coverage threshold given each
 * provider's coverage start, or null if it never can.
 */
export function firstCoverableDate(providers: ProviderCoverage[]): Date | null {
  const needed = Math.ceil(providers.length * COVERAGE_THRESHOLD);
  if (needed === 0) return null;
  const starts = providers
    .map((p) => p.coverageStart)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (starts.length < needed) return null;
  // The window must start on/after coverage, so the first full day after it
  const windowStart = startOfUtcDay(new Date(starts[needed - 1].getTime() + DAY_MS - 1));
  return new Date(windowStart.getTime() + (WINDOW_DAYS - 1) * DAY_MS);
}

/**
 * Completed days (UTC) to score on a run at `now`: always the trailing
 * TRAILING_RECOMPUTE_DAYS, plus any earlier coverable day not yet scored with
 * coverage data. Today is never scored; it isn't over yet.
 */
export function datesToScore(
  now: Date,
  providers: ProviderCoverage[],
  scoredDates: Set<string>
): Date[] {
  const today = startOfUtcDay(now);
  const lastComplete = new Date(today.getTime() - DAY_MS);
  const trailingFrom = new Date(today.getTime() - TRAILING_RECOMPUTE_DAYS * DAY_MS);
  const first = firstCoverableDate(providers);

  const dates: Date[] = [];
  const from = first && first < trailingFrom ? first : trailingFrom;
  for (let t = from.getTime(); t <= lastComplete.getTime(); t += DAY_MS) {
    const d = new Date(t);
    if (d >= trailingFrom || !scoredDates.has(toDateStr(d))) dates.push(d);
  }
  return dates;
}
