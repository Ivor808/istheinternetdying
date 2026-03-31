import type { StatusProvider, ProviderIncident } from './types';

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
  resolved_at: string | null;
  status: string;
  components: AtlassianComponent[];
  [key: string]: unknown;
}

interface AtlassianResponse {
  incidents: AtlassianIncident[];
}

export function mapImpactToSeverity(
  impact: string
): 'minor' | 'major' | 'critical' {
  switch (impact) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'major';
    default:
      return 'minor';
  }
}

/**
 * Determine if an incident represents a real service degradation.
 * Filters out:
 * - impact "none" — informational posts, maintenance notices, rollouts
 * - scheduled maintenance filed as incidents (long duration + no impact)
 */
export function isRealOutage(incident: AtlassianIncident): boolean {
  // "none" impact = not a real outage
  if (incident.impact === 'none') return false;

  return true;
}

export function parseAtlassianIncident(
  raw: AtlassianIncident
): ProviderIncident {
  return {
    externalId: raw.id,
    title: raw.name,
    severity: mapImpactToSeverity(raw.impact),
    startedAt: new Date(raw.created_at),
    resolvedAt: raw.resolved_at ? new Date(raw.resolved_at) : null,
    raw: raw as Record<string, unknown>,
  };
}

export const atlassianProvider: StatusProvider = {
  type: 'atlassian',

  async fetchIncidents(
    statusPageUrl: string,
    since: Date
  ): Promise<ProviderIncident[]> {
    const incidents: ProviderIncident[] = [];
    let page = 1;

    while (true) {
      const url = `${statusPageUrl}/api/v2/incidents.json?page=${page}&per_page=100`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`
        );
      }

      const data: AtlassianResponse = await response.json();

      if (data.incidents.length === 0) break;

      let reachedSince = false;
      for (const incident of data.incidents) {
        const createdAt = new Date(incident.created_at);
        if (createdAt < since) {
          reachedSince = true;
          break;
        }
        if (isRealOutage(incident)) {
          incidents.push(parseAtlassianIncident(incident));
        }
      }

      if (reachedSince || data.incidents.length < 100) break;
      page++;
    }

    return incidents;
  },
};
