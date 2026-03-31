export interface ProviderIncident {
  externalId: string;
  title: string;
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
  raw: Record<string, unknown>;
}

export interface StatusProvider {
  type: string;
  fetchIncidents(
    statusPageUrl: string,
    since: Date
  ): Promise<ProviderIncident[]>;
}

export interface ProviderConfig {
  name: string;
  slug: string;
  category: string;
  providerType: string;
  statusPageUrl: string;
}
