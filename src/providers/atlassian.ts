import type { StatusProvider, ProviderIncident, FetchResult } from './types';

interface AtlassianComponent {
  id: string;
  name: string;
  status: string;
}

interface AtlassianIncident {
  id: string;
  name: string;
  impact: string;
  created_at: string;
  // When the provider says the problem began; can be earlier than created_at
  started_at?: string | null;
  resolved_at: string | null;
  status: string;
  components?: AtlassianComponent[];
  [key: string]: unknown;
}

interface AtlassianResponse {
  incidents: AtlassianIncident[];
}

type Severity = ProviderIncident['severity'];

// Null for anything that isn't an outage level ("none", "maintenance", or new values)
export function mapImpactToSeverity(impact: string): Severity | null {
  switch (impact) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'major';
    case 'minor':
      return 'minor';
    default:
      return null;
  }
}

/**
 * Determine if an incident represents a real service degradation.
 * Filters out:
 * - impact "none": informational posts, rollout notices
 * - impact "maintenance": scheduled maintenance filed as an incident
 * - any impact we don't recognise (logged by fetchIncidents)
 */
export function isRealOutage(incident: AtlassianIncident): boolean {
  return mapImpactToSeverity(incident.impact) !== null;
}

const KNOWN_NON_OUTAGE_IMPACTS = new Set(['none', 'maintenance']);

export function parseAtlassianIncident(
  raw: AtlassianIncident
): ProviderIncident {
  const severity = mapImpactToSeverity(raw.impact);
  if (!severity) throw new Error(`Not an outage: impact "${raw.impact}"`);
  return {
    externalId: raw.id,
    title: raw.name,
    severity,
    startedAt: new Date(raw.started_at ?? raw.created_at),
    resolvedAt: raw.resolved_at ? new Date(raw.resolved_at) : null,
    raw: raw as Record<string, unknown>,
  };
}

const PRIVATE_HOST_PATTERNS = /^(localhost|127\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\])/;

function validateStatusPageUrl(statusPageUrl: string): URL {
  const url = new URL(statusPageUrl);
  if (url.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed, got: ${url.protocol}`);
  }
  if (PRIVATE_HOST_PATTERNS.test(url.hostname)) {
    throw new Error(`Private/internal URLs are not allowed: ${url.hostname}`);
  }
  return url;
}

export const atlassianProvider: StatusProvider = {
  type: 'atlassian',

  // The endpoint ignores page/per_page and always returns the ~50 most recent
  // incidents, so one request is all there is. History builds up across runs.
  async fetchIncidents(statusPageUrl: string): Promise<FetchResult> {
    validateStatusPageUrl(statusPageUrl);

    const url = `${statusPageUrl}/api/v2/incidents.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
    }

    const data: AtlassianResponse = await response.json();

    const incidents: ProviderIncident[] = [];
    const excludedIds: string[] = [];
    let oldest: number | null = null;
    for (const incident of data.incidents) {
      const created = Date.parse(incident.created_at);
      if (Number.isFinite(created) && (oldest === null || created < oldest)) oldest = created;

      if (isRealOutage(incident)) {
        incidents.push(parseAtlassianIncident(incident));
      } else {
        excludedIds.push(incident.id);
        if (!KNOWN_NON_OUTAGE_IMPACTS.has(incident.impact)) {
          console.warn(`[atlassian] Skipping ${incident.id} at ${statusPageUrl}: unknown impact "${incident.impact}"`);
        }
      }
    }

    return {
      incidents,
      excludedIds,
      oldestListedAt: oldest === null ? null : new Date(oldest),
    };
  },
};
