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
