import { computeDayStats } from '../scoring/provider-score';

export interface GridIncident {
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
}

export interface GridService {
  slug: string;
  name: string;
  category: string;
  // One entry per day in ServiceGrid.days
  scores: number[];
  hours: number[];
  worst: number[];
  incidentsThisWeek: number;
  openNow: boolean;
}

export interface ServiceGrid {
  generatedAt: string;
  // Last time the sync fetched incident feeds; null if unknown
  syncedAt: string | null;
  days: string[];
  services: GridService[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Matches the longest scoring cap: older open incidents are treated as stale
const OPEN_CUTOFF_MS = 7 * DAY_MS;

export const GRID_DAYS = 90;

export function buildServiceGrid(
  providers: Array<{ slug: string; name: string; category: string }>,
  incidentsBySlug: Map<string, GridIncident[]>,
  now: Date,
  syncedAt: Date | null = null,
  dayCount = GRID_DAYS
): ServiceGrid {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: string[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    days.push(new Date(todayStart - i * DAY_MS).toISOString().slice(0, 10));
  }
  const weekStart = now.getTime() - 7 * DAY_MS;

  const services = providers.map((p) => {
    const incidents = incidentsBySlug.get(p.slug) ?? [];
    const scores: number[] = [];
    const hours: number[] = [];
    const worst: number[] = [];
    for (const day of days) {
      const stats = computeDayStats(incidents, new Date(`${day}T00:00:00Z`), now);
      scores.push(stats.score);
      hours.push(Math.round(stats.hours * 10) / 10);
      worst.push(stats.worst);
    }
    return {
      ...p,
      scores,
      hours,
      worst,
      incidentsThisWeek: incidents.filter((i) => i.startedAt.getTime() >= weekStart).length,
      openNow: incidents.some(
        (i) =>
          i.resolvedAt === null &&
          i.startedAt <= now &&
          now.getTime() - i.startedAt.getTime() < OPEN_CUTOFF_MS
      ),
    };
  });

  return { generatedAt: now.toISOString(), syncedAt: syncedAt?.toISOString() ?? null, days, services };
}

// Grid colouring: how many points a row lost that day, compared with what's normal for that row.
// Every day has some minor incident somewhere, so "any incident" would paint everything red;
// red is kept for days clearly worse than the row's usual.

// A row's normal ceiling never drops below these, so a usually-quiet row doesn't go red over a blip
export const NORMAL_FLOOR = { category: 3, service: 10 };

// Points lost that day (100 − score), averaged over the services in the row
export function dayLoss(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((a, s) => a + (100 - s), 0) / scores.length;
}

// Upper edge of "normal" for a row: its 75th percentile day, or the floor
export function normalCeiling(losses: number[], floor: number): number {
  if (losses.length === 0) return floor;
  const sorted = [...losses].sort((a, b) => a - b);
  return Math.max(floor, sorted[Math.floor((sorted.length - 1) * 0.75)]);
}

// 0 = no loss, 1 = normal, 2..5 = worse than usual (each step about double the last)
export function lossLevel(loss: number, ceiling: number): number {
  if (loss <= 0) return 0;
  if (loss <= ceiling) return 1;
  if (loss <= ceiling * 2) return 2;
  if (loss <= ceiling * 4) return 3;
  if (loss <= ceiling * 8) return 4;
  return 5;
}
