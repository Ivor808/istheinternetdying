export interface ProviderIncident {
  externalId: string;
  title: string;
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
  raw: Record<string, unknown>;
}

export interface FetchResult {
  // Real outages, ready to store
  incidents: ProviderIncident[];
  // Listed but not outages (maintenance, informational, unknown impact).
  // Stored copies are removed so reclassified incidents stop counting.
  excludedIds: string[];
  // created_at of the oldest incident in the response. The feed lists the
  // most recent incidents only, so it is complete from here on. Null when empty.
  oldestListedAt: Date | null;
}

export interface StatusProvider {
  type: string;
  fetchIncidents(statusPageUrl: string): Promise<FetchResult>;
}

export interface ProviderConfig {
  name: string;
  slug: string;
  category: string;
  providerType: string;
  statusPageUrl: string;
}
