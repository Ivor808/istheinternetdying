import { providerConfigs } from '../providers/config';

// Current state of every provider from Statuspage's tiny /api/v2/status.json.
// One shared check every few minutes serves every visitor.

export type LiveIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance' | 'unknown';

export interface LiveService {
  slug: string;
  name: string;
  indicator: LiveIndicator;
  description: string;
}

export interface LiveStatus {
  checkedAt: string;
  services: LiveService[];
  // How many providers couldn't be reached on this check
  failed: number;
}

export const LIVE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 5000;
const KNOWN: LiveIndicator[] = ['none', 'minor', 'major', 'critical', 'maintenance'];

export function isIssue(indicator: LiveIndicator): boolean {
  return indicator === 'minor' || indicator === 'major' || indicator === 'critical';
}

let cached: LiveStatus | null = null;
let inFlight: Promise<LiveStatus> | null = null;

async function checkOne(p: (typeof providerConfigs)[number]): Promise<LiveService> {
  try {
    const res = await fetch(`${p.statusPageUrl.replace(/\/$/, '')}/api/v2/status.json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { status?: { indicator?: string; description?: string } };
    const indicator = KNOWN.includes(body.status?.indicator as LiveIndicator)
      ? (body.status!.indicator as LiveIndicator)
      : 'unknown';
    return { slug: p.slug, name: p.name, indicator, description: body.status?.description ?? '' };
  } catch {
    return { slug: p.slug, name: p.name, indicator: 'unknown', description: '' };
  }
}

async function refresh(): Promise<LiveStatus> {
  const services = await Promise.all(providerConfigs.map(checkOne));
  return {
    checkedAt: new Date().toISOString(),
    services,
    failed: services.filter((s) => s.indicator === 'unknown').length,
  };
}

// Serves the cached check while it's fresh; concurrent callers share one refresh
export async function getLiveStatus(now = Date.now()): Promise<LiveStatus> {
  if (cached && now - Date.parse(cached.checkedAt) < LIVE_TTL_MS) return cached;
  if (!inFlight) {
    inFlight = refresh()
      .then((status) => {
        cached = status;
        return status;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
