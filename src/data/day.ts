import { and, eq, gt, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/client';
import { incidents, providers } from '../db/schema';
import { providerConfigs } from '../providers/config';
import { MAX_DURATION_MS } from '../scoring/provider-score';
import { getDashboardData } from './dashboard';
import { displayName, fameRank, normalBand, toDeath } from './death';
import { EVENTS, type TimelineEvent } from './events';
import { getMockIncidents } from './mock';

// One page per scored day, built from the same incidents and index rows as the dashboard.
// Only notable days are offered to search engines.

type Severity = 'minor' | 'major' | 'critical';

export interface DayIncident {
  slug: string;
  name: string;
  title: string;
  severity: Severity;
  startedAt: string;
  resolvedAt: string | null;
  // Time the incident was open within this day
  hours: number;
  statusUrl: string | null;
}

export interface DayData {
  date: string;
  death: number;
  weekBefore: number | null;
  band: [number, number] | null;
  incidents: DayIncident[];
  events: TimelineEvent[];
  notable: boolean;
  prev: string | null;
  next: string | null;
}

interface RawIncident {
  slug: string;
  name: string;
  title: string;
  severity: Severity;
  startedAt: Date;
  resolvedAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RANK: Record<Severity, number> = { minor: 1, major: 2, critical: 3 };
// Longest any incident can count for, matching scoring's per-severity caps
const STALE_MS = Math.max(...Object.values(MAX_DURATION_MS));

// A day is notable if something we track as an event happened, the index rose sharply,
// or several services had serious incidents at once
export const NOTABLE_RISE = 5;
export const NOTABLE_SERVICES = 3;

const STATUS_URL = new Map(providerConfigs.map((p) => [p.slug, p.statusPageUrl]));

const dayStartOf = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

// Same counting as scoring: open incidents run to now, and every incident is capped by severity
export function hoursWithinDay(
  i: { severity: Severity; startedAt: Date; resolvedAt: Date | null },
  date: string,
  now: Date
): number {
  const start = dayStartOf(date);
  const end = Math.min(start + DAY_MS, now.getTime());
  const cap = i.startedAt.getTime() + MAX_DURATION_MS[RANK[i.severity]];
  const until = Math.min(i.resolvedAt ? i.resolvedAt.getTime() : now.getTime(), cap);
  return Math.max(0, Math.min(until, end) - Math.max(i.startedAt.getTime(), start)) / HOUR_MS;
}

export function isNotable(day: { events: TimelineEvent[]; majorServices: number; rise: number | null }): boolean {
  return (
    day.events.some((e) => e.category === 'outage' || e.major) ||
    day.majorServices >= NOTABLE_SERVICES ||
    (day.rise !== null && day.rise >= NOTABLE_RISE)
  );
}

// Distinct services with a major or critical incident open on each date
export function majorServicesByDate(list: RawIncident[], now: Date): Map<string, Set<string>> {
  const byDate = new Map<string, Set<string>>();
  for (const i of list) {
    if (RANK[i.severity] < RANK.major) continue;
    for (let t = dayStartOf(dateOf(i.startedAt.getTime())); t < now.getTime(); t += DAY_MS) {
      const date = dateOf(t);
      if (hoursWithinDay(i, date, now) <= 0) break;
      const set = byDate.get(date) ?? new Set<string>();
      set.add(i.slug);
      byDate.set(date, set);
    }
  }
  return byDate;
}

type History = Array<{ date: string; globalScore: number }>;

function riseOn(history: History, idx: number): number | null {
  if (idx <= 0) return null;
  return toDeath(history[idx].globalScore) - toDeath(history[idx - 1].globalScore);
}

const eventsOn = (date: string) => EVENTS.filter((e) => e.date === date);

export function notableDates(history: History, majorByDate: Map<string, Set<string>>): string[] {
  return history
    .filter((h, idx) =>
      isNotable({
        events: eventsOn(h.date),
        majorServices: majorByDate.get(h.date)?.size ?? 0,
        rise: riseOn(history, idx),
      })
    )
    .map((h) => h.date);
}

// Worst first, then the names people know, then the longest
export function sortIncidents(list: DayIncident[]): DayIncident[] {
  return [...list].sort(
    (a, b) => RANK[b.severity] - RANK[a.severity] || fameRank(a.slug) - fameRank(b.slug) || b.hours - a.hours
  );
}

async function loadIncidents(from: Date, to: Date, severities?: Severity[]): Promise<RawIncident[]> {
  if (import.meta.env.MODE === 'mock') {
    const out: RawIncident[] = [];
    const names = new Map(providerConfigs.map((p) => [p.slug, p.name]));
    for (const [slug, list] of getMockIncidents()) {
      for (const i of list) {
        if (i.startedAt >= to || i.startedAt < new Date(from.getTime() - STALE_MS)) continue;
        if (severities && !severities.includes(i.severity)) continue;
        out.push({ slug, name: names.get(slug) ?? slug, ...i });
      }
    }
    return out;
  }

  const rows = await db
    .select({
      slug: providers.slug,
      name: providers.name,
      title: incidents.title,
      severity: incidents.severity,
      startedAt: incidents.startedAt,
      resolvedAt: incidents.resolvedAt,
    })
    .from(incidents)
    .innerJoin(providers, eq(incidents.providerId, providers.id))
    .where(
      and(
        lt(incidents.startedAt, to),
        gte(incidents.startedAt, new Date(from.getTime() - STALE_MS)),
        or(isNull(incidents.resolvedAt), gt(incidents.resolvedAt, from)),
        severities ? inArray(incidents.severity, severities) : undefined
      )
    );
  return rows.map((r) => ({ ...r, severity: r.severity as Severity }));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function getDay(date: string, now = new Date()): Promise<DayData | null> {
  if (!DATE_RE.test(date)) return null;
  const { history } = await getDashboardData();
  const idx = history.findIndex((h) => h.date === date);
  if (idx === -1) return null;

  const start = new Date(dayStartOf(date));
  const raw = await loadIncidents(start, new Date(start.getTime() + DAY_MS));
  const dayIncidents = sortIncidents(
    raw
      .map((i) => ({ ...i, hours: hoursWithinDay(i, date, now) }))
      .filter((i) => i.hours > 0)
      .map((i) => ({
        slug: i.slug,
        name: displayName(i.slug, i.name),
        title: i.title,
        severity: i.severity,
        startedAt: i.startedAt.toISOString(),
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
        hours: i.hours,
        statusUrl: STATUS_URL.get(i.slug) ?? null,
      }))
  );
  const majorServices = new Set(dayIncidents.filter((i) => RANK[i.severity] >= RANK.major).map((i) => i.slug)).size;
  const weekBefore = history.find((h) => h.date === dateOf(start.getTime() - 7 * DAY_MS));
  const events = eventsOn(date);

  return {
    date,
    death: toDeath(history[idx].globalScore),
    weekBefore: weekBefore ? toDeath(weekBefore.globalScore) : null,
    band: normalBand(history.slice(0, idx + 1).map((h) => toDeath(h.globalScore))),
    incidents: dayIncidents,
    events,
    notable: isNotable({ events, majorServices, rise: riseOn(history, idx) }),
    prev: history[idx - 1]?.date ?? null,
    next: history[idx + 1]?.date ?? null,
  };
}

export async function getNotableDays(now = new Date()): Promise<string[]> {
  const { history } = await getDashboardData();
  if (history.length === 0) return [];
  const raw = await loadIncidents(new Date(dayStartOf(history[0].date)), now, ['major', 'critical']);
  return notableDates(history, majorServicesByDate(raw, now));
}
