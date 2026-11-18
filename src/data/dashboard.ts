import { db } from '../db/client';
import { dailyIndex, providers, monthlyCves, incidents } from '../db/schema';
import { gte } from 'drizzle-orm';
import { isIndexCovered } from '../scoring/daily-index';
import { getMockDashboardData, getMockServiceGrid } from './mock';
import { GRID_DAYS, buildServiceGrid, type GridIncident, type ServiceGrid } from './service-grid';

// Scores are unrounded; round at display. Only dates with adequate provider
// coverage (COVERAGE_THRESHOLD) are included, and only completed days.
export interface DashboardData {
  current: {
    globalScore: number;
    categoryScores: Record<string, number>;
    date: string;
  } | null;
  previous: {
    globalScore: number;
    date: string;
  } | null;
  history: Array<{
    date: string;
    globalScore: number;
    categoryScores: Record<string, number>;
  }>;
  cveCounts: Array<{
    date: string;
    count: number;
  }>;
}

export async function getDashboardData(): Promise<DashboardData> {
  if (import.meta.env.MODE === 'mock') return getMockDashboardData();

  const history = await getCoveredHistory();
  const current = history[history.length - 1];
  const currentDate = current ? new Date(current.date + 'T00:00:00Z') : null;
  const sevenDaysBeforeStr = currentDate
    ? new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;
  const previous = history.find((h) => h.date === sevenDaysBeforeStr);

  const cveRows = await db
    .select({ date: monthlyCves.date, count: monthlyCves.count })
    .from(monthlyCves)
    .orderBy(monthlyCves.date);

  return {
    current: current
      ? {
          globalScore: current.globalScore,
          categoryScores: current.categoryScores,
          date: current.date,
        }
      : null,
    previous: previous
      ? {
          globalScore: previous.globalScore,
          date: previous.date,
        }
      : null,
    history,
    cveCounts: cveRows,
  };
}

// Index rows with adequate coverage, oldest first
export async function getCoveredHistory(): Promise<DashboardData['history']> {
  const rows = await db.select().from(dailyIndex).orderBy(dailyIndex.date);
  return rows.filter(isIndexCovered).map((h) => ({
    date: h.date,
    globalScore: Number(h.globalScore),
    categoryScores: h.categoryScores,
  }));
}

// Per-service daily stats for the last GRID_DAYS days, straight from incidents
export async function getServiceGrid(): Promise<ServiceGrid> {
  if (import.meta.env.MODE === 'mock') return getMockServiceGrid();

  const now = new Date();
  // Look back an extra week so incidents that started before the window still count
  const since = new Date(now.getTime() - (GRID_DAYS + 7) * 24 * 60 * 60 * 1000);

  const providerRows = await db
    .select({
      id: providers.id,
      slug: providers.slug,
      name: providers.name,
      category: providers.category,
      lastFetchedAt: providers.lastFetchedAt,
    })
    .from(providers)
    .orderBy(providers.category, providers.name);

  const rows = await db
    .select({
      providerId: incidents.providerId,
      severity: incidents.severity,
      startedAt: incidents.startedAt,
      resolvedAt: incidents.resolvedAt,
    })
    .from(incidents)
    .where(gte(incidents.startedAt, since));

  const slugById = new Map(providerRows.map((p) => [p.id, p.slug]));
  const incidentsBySlug = new Map<string, GridIncident[]>();
  for (const r of rows) {
    const slug = slugById.get(r.providerId);
    if (!slug) continue;
    const list = incidentsBySlug.get(slug) ?? [];
    list.push({
      severity: r.severity as GridIncident['severity'],
      startedAt: r.startedAt,
      resolvedAt: r.resolvedAt,
    });
    incidentsBySlug.set(slug, list);
  }

  const fetched = providerRows.flatMap((p) => (p.lastFetchedAt ? [p.lastFetchedAt.getTime()] : []));
  const syncedAt = fetched.length > 0 ? new Date(Math.max(...fetched)) : null;
  return buildServiceGrid(providerRows, incidentsBySlug, now, syncedAt);
}
