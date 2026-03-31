interface IncidentWindow {
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
}

const SEVERITY_RANK: Record<string, number> = {
  minor: 1,
  major: 2,
  critical: 3,
};

const SEVERITY_POINTS_PER_HOUR: Record<number, number> = {
  1: 5,   // minor
  2: 15,  // major
  3: 30,  // critical
};

/**
 * Severity Envelope scoring model.
 *
 * Instead of summing deductions per incident (which penalizes granular
 * reporters like Twilio), we compute the MAX severity active at each
 * moment during the day, then deduct based on that envelope.
 *
 * 5 overlapping minor incidents = same score as 1 minor incident.
 * 1 minor + 1 major overlapping = scored as major for the overlap.
 */
export function computeSingleDayScore(
  incidents: IncidentWindow[],
  day: Date
): number {
  const dayStart = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Collect all time boundaries where severity might change
  const edges = new Set<number>();
  edges.add(dayStart.getTime());
  edges.add(dayEnd.getTime());

  const dayIncidents: Array<{
    start: number;
    end: number;
    rank: number;
  }> = [];

  for (const incident of incidents) {
    const incStart = Math.max(incident.startedAt.getTime(), dayStart.getTime());
    const incEnd = Math.min(
      (incident.resolvedAt ?? dayEnd).getTime(),
      dayEnd.getTime()
    );

    if (incStart >= incEnd) continue;

    const rank = SEVERITY_RANK[incident.severity] ?? 0;
    if (rank === 0) continue;

    dayIncidents.push({ start: incStart, end: incEnd, rank });
    edges.add(incStart);
    edges.add(incEnd);
  }

  if (dayIncidents.length === 0) return 100;

  // Sort edges chronologically
  const sortedEdges = Array.from(edges).sort((a, b) => a - b);

  let deduction = 0;

  // Walk through each interval between consecutive edges
  for (let i = 0; i < sortedEdges.length - 1; i++) {
    const intervalStart = sortedEdges[i];
    const intervalEnd = sortedEdges[i + 1];
    const intervalHours = (intervalEnd - intervalStart) / (1000 * 60 * 60);

    // Find the max severity rank active during this interval
    let maxRank = 0;
    for (const inc of dayIncidents) {
      if (inc.start <= intervalStart && inc.end >= intervalEnd) {
        maxRank = Math.max(maxRank, inc.rank);
      }
    }

    if (maxRank > 0) {
      deduction += (SEVERITY_POINTS_PER_HOUR[maxRank] ?? 0) * intervalHours;
    }
  }

  return Math.max(0, Math.round(100 - deduction));
}

export function computeRollingScore(
  incidents: IncidentWindow[],
  date: Date
): number {
  let total = 0;

  for (let i = 6; i >= 0; i--) {
    const day = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - i)
    );
    total += computeSingleDayScore(incidents, day);
  }

  return Math.round(total / 7);
}
