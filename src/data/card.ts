import { getDashboardData } from './dashboard';
import type { DayData } from './day';
import { displayName, fameRank, normalBand, toDeath } from './death';
import { getLiveStatus, isIssue } from './live-status';

// What the shareable Death Index card shows: the page card, the share image, the embed and the badge

export interface CardData {
  date: string;
  death: number;
  // Change vs 7 days earlier, rounded the same way as the headline number
  delta: number | null;
  band: [number, number] | null;
  // Most familiar first
  services: Array<{ slug: string; name: string }>;
  servicesLabel: string;
  // Today's card shows what's broken now; a past day's shows what broke that day
  live: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Latest scored day, with whatever is broken right now
export async function getTodayCard(): Promise<CardData | null> {
  const [{ history }, live] = await Promise.all([getDashboardData(), getLiveStatus()]);
  const current = history[history.length - 1];
  if (!current) return null;
  const weekAgoDate = new Date(Date.parse(`${current.date}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
  const weekAgo = history.find((h) => h.date === weekAgoDate);
  const death = Math.round(toDeath(current.globalScore));

  // Mostly unreachable status pages would make "nothing broken" a lie
  const liveOk = live.failed <= live.services.length / 2;
  const broken = liveOk
    ? live.services
        .filter((s) => isIssue(s.indicator))
        .sort((a, b) => fameRank(a.slug) - fameRank(b.slug))
        .map((s) => ({ slug: s.slug, name: displayName(s.slug, s.name) }))
    : [];

  return {
    date: current.date,
    death,
    delta: weekAgo ? death - Math.round(toDeath(weekAgo.globalScore)) : null,
    band: normalBand(history.map((h) => toDeath(h.globalScore))),
    services: broken,
    servicesLabel: broken.length === 1 ? 'service having issues now' : 'services having issues now',
    live: true,
  };
}

export function cardFromDay(day: DayData): CardData {
  const death = Math.round(day.death);
  // Incidents are already worst-first; keep one entry per service
  const seen = new Set<string>();
  const services = day.incidents.flatMap((i) => (seen.has(i.slug) ? [] : (seen.add(i.slug), [{ slug: i.slug, name: i.name }])));
  return {
    date: day.date,
    death,
    delta: day.weekBefore !== null ? death - Math.round(day.weekBefore) : null,
    band: day.band,
    services,
    servicesLabel: services.length === 1 ? 'service had incidents' : 'services had incidents',
    live: false,
  };
}
