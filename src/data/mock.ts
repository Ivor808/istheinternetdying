import type { DashboardData, ProviderHistory } from './dashboard';
import { EVENTS } from './events';
import { providerConfigs } from '../providers/config';
import { GRID_DAYS, buildServiceGrid, type GridIncident, type ServiceGrid } from './service-grid';

// Synthetic dashboard data for local UI work without a database (MOCK_DATA=1).
// Deterministic, and shaped like production: unrounded daily points for
// completed days only, starting when collection reached full coverage, with
// dips around the outage events.

const CATEGORY_BASE: Record<string, number> = {
  'cloud-infra': 93,
  ai: 86,
  'dev-tools': 91,
  productivity: 95,
  comms: 94,
  fintech: 96,
};

const PROVIDERS = [
  { slug: 'cloudflare', name: 'Cloudflare', category: 'cloud-infra' },
  { slug: 'github', name: 'GitHub', category: 'dev-tools' },
  { slug: 'openai', name: 'OpenAI', category: 'ai' },
  { slug: 'anthropic', name: 'Anthropic', category: 'ai' },
  { slug: 'discord', name: 'Discord', category: 'comms' },
  { slug: 'npm', name: 'npm', category: 'dev-tools' },
  { slug: 'dropbox', name: 'Dropbox', category: 'productivity' },
  { slug: 'reddit', name: 'Reddit', category: 'comms' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
// Stand-in for the first day with adequate coverage in production
const DAILY_FROM = Date.UTC(2026, 6, 1);

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

// Scores use a 7-day rolling window, so an outage drags the index for a week
function outageDip(time: number): number {
  let dip = 0;
  for (const e of EVENTS) {
    if (e.category !== 'outage') continue;
    const days = (time - Date.parse(e.date)) / DAY_MS;
    if (days < 0 || days >= 7) continue;
    dip += (e.major ? 22 : 9) * (1 - days / 7);
  }
  return dip;
}

function series(key: string, base: number, time: number, dipWeight: number): number {
  const rand = mulberry32(hash(key) ^ Math.floor(time / DAY_MS));
  const noise = (rand() - 0.5) * 6;
  const incident = rand() > 0.94 ? rand() * 18 : 0;
  // Slow decline, so the trend is visible
  const drift = Math.max(0, (time - DAILY_FROM) / DAY_MS) * 0.012;
  return clamp(base + noise - incident - drift - outageDip(time) * dipWeight);
}

const iso = (t: number) => new Date(t).toISOString().split('T')[0];

// Up to yesterday: today isn't scored until it's over
function timeline(): { end: number; times: number[] } {
  const now = new Date();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY_MS;
  const times: number[] = [];
  for (let t = DAILY_FROM; t <= end; t += DAY_MS) times.push(t);
  return { end, times };
}

export function getMockProviderHistory(): ProviderHistory {
  const { times } = timeline();
  const providerHistory: ProviderHistory = [];
  for (const p of PROVIDERS) {
    for (const t of times) {
      providerHistory.push({
        date: iso(t),
        slug: p.slug,
        name: p.name,
        score: series(p.slug, CATEGORY_BASE[p.category], t, 1.6),
      });
    }
  }
  return providerHistory;
}

export function getMockDashboardData(): DashboardData {
  const { end, times } = timeline();

  const history: DashboardData['history'] = times.map((t) => {
    const categoryScores: Record<string, number> = {};
    for (const [cat, base] of Object.entries(CATEGORY_BASE)) {
      const weight = cat === 'cloud-infra' ? 1.4 : cat === 'fintech' ? 0.5 : 1;
      categoryScores[cat] = series(cat, base, t, weight);
    }
    const values = Object.values(categoryScores);
    const globalScore = values.reduce((sum, s) => sum + s, 0) / values.length;
    return { date: iso(t), globalScore, categoryScores };
  });

  const cveCounts: DashboardData['cveCounts'] = [];
  const cveRand = mulberry32(hash('cves'));
  for (let y = 2024, i = 0; ; y++) {
    for (let m = 0; m < 12; m++, i++) {
      const t = Date.UTC(y, m, 1);
      if (t > end) break;
      cveCounts.push({
        date: iso(t),
        count: Math.round(2900 + i * 55 + (cveRand() - 0.5) * 700),
      });
    }
    if (Date.UTC(y + 1, 0, 1) > end) break;
  }

  const current = history[history.length - 1];
  const previous = history.find((h) => h.date === iso(end - 7 * DAY_MS)) ?? null;

  return {
    current,
    previous: previous
      ? { globalScore: previous.globalScore, date: previous.date }
      : null,
    history,
    providers: PROVIDERS.map(({ slug, name }) => ({ slug, name })),
    cveCounts,
  };
}

const INCIDENT_RATE: Record<string, number> = {
  ai: 0.1,
  'cloud-infra': 0.06,
  'dev-tools': 0.06,
  comms: 0.05,
  productivity: 0.04,
  fintech: 0.03,
};

const HOUR_MS = 60 * 60 * 1000;

const MOCK_TITLES = [
  'Elevated error rates',
  'Degraded performance for some users',
  'Increased API latency',
  'Partial outage',
  'Login failures for some users',
  'Delayed notifications',
  'Dashboard unavailable',
];

export interface MockIncident extends GridIncident {
  title: string;
}

// Fake incidents for every real provider, with shared outages on the event dates
export function getMockIncidents(now = new Date()): Map<string, MockIncident[]> {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const firstDay = Math.min(todayStart - (GRID_DAYS + 7) * DAY_MS, DAILY_FROM - 7 * DAY_MS);
  const outageDays = new Set(
    EVENTS.filter((e) => e.category === 'outage').map((e) => Date.parse(`${e.date}T00:00:00Z`))
  );
  const openSlugs = new Set(
    [...providerConfigs]
      .sort((a, b) => hash(a.slug + iso(todayStart)) - hash(b.slug + iso(todayStart)))
      .slice(0, 3)
      .map((p) => p.slug)
  );

  const incidentsBySlug = new Map<string, MockIncident[]>();
  for (const p of providerConfigs) {
    const list: MockIncident[] = [];
    for (let day = firstDay; day <= todayStart; day += DAY_MS) {
      const rand = mulberry32(hash(p.slug) ^ Math.floor(day / DAY_MS));
      const shared = outageDays.has(day) && p.category !== 'fintech' && rand() < 0.55;
      if (!shared && rand() >= (INCIDENT_RATE[p.category] ?? 0.05)) continue;
      const roll = rand();
      const severity: GridIncident['severity'] = shared ? 'major' : roll < 0.72 ? 'minor' : roll < 0.95 ? 'major' : 'critical';
      const duration = shared
        ? 2 + rand() * 4
        : severity === 'minor'
          ? 0.5 + rand() * 4.5
          : severity === 'major'
            ? 0.3 + rand() * 2.7
            : 0.2 + rand() * 1.3;
      const startedAt = new Date(day + (shared ? 13 : Math.floor(rand() * 23)) * HOUR_MS);
      const end = new Date(startedAt.getTime() + duration * HOUR_MS);
      if (startedAt >= now) continue;
      const title = MOCK_TITLES[Math.floor(rand() * MOCK_TITLES.length)];
      list.push({ severity, startedAt, resolvedAt: end < now ? end : null, title });
    }
    if (openSlugs.has(p.slug)) {
      const rand = mulberry32(hash(p.slug + 'open'));
      list.push({
        severity: rand() < 0.7 ? 'minor' : 'major',
        startedAt: new Date(now.getTime() - (1 + rand() * 4) * HOUR_MS),
        resolvedAt: null,
        title: 'Investigating elevated error rates',
      });
    }
    incidentsBySlug.set(p.slug, list);
  }
  return incidentsBySlug;
}

export function getMockServiceGrid(now = new Date()): ServiceGrid {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return buildServiceGrid(
    providerConfigs,
    getMockIncidents(now),
    now,
    new Date(Math.min(now.getTime(), todayStart + 6 * HOUR_MS))
  );
}
