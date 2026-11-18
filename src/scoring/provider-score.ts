interface IncidentWindow {
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
}

/**
 * Maximum incident duration for scoring purposes (in ms).
 * Incidents open longer than this are likely stale status page entries,
 * not active outages. We still store the real data but cap the scoring
 * impact. Different caps per severity:
 * - Critical: 72 hours (3 days) — real critical outages get resolved fast
 * - Major: 120 hours (5 days)
 * - Minor: 168 hours (7 days) — minor issues can linger longer
 */
const MAX_DURATION_MS: Record<number, number> = {
  1: 7 * 24 * 60 * 60 * 1000,   // minor: 7 days
  2: 5 * 24 * 60 * 60 * 1000,   // major: 5 days
  3: 3 * 24 * 60 * 60 * 1000,   // critical: 3 days
};

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
 * Lowest score a day can reach, by the worst severity seen that day.
 * Without this, 20 hours of "minor" (often an incident left in monitoring)
 * would score the same 0 as a day-long critical outage.
 */
export const SEVERITY_FLOOR: Record<number, number> = {
  0: 100, // nothing happened
  1: 70,  // minor
  2: 40,  // major
  3: 0,   // critical
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
  return computeDayStats(incidents, day).score;
}

export interface DayStats {
  score: number;
  // Hours with at least one incident active
  hours: number;
  // Highest severity rank seen: 0 none, 1 minor, 2 major, 3 critical
  worst: number;
}

/**
 * Same envelope as computeSingleDayScore, plus how long the provider was
 * degraded. `until` cuts off still-open incidents (e.g. "now" for today);
 * without it they run to the end of the day, as the score always has.
 */
export function computeDayStats(
  incidents: IncidentWindow[],
  day: Date,
  until?: Date
): DayStats {
  const dayStart = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const openEnd = until && until < dayEnd ? until : dayEnd;

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
    const rank = SEVERITY_RANK[incident.severity] ?? 0;
    if (rank === 0) continue;

    // Cap incident duration to prevent stale entries from tanking scores forever
    const maxDuration = MAX_DURATION_MS[rank] ?? MAX_DURATION_MS[1];
    const rawEnd = incident.resolvedAt ?? openEnd;
    const cappedEnd = new Date(
      Math.min(rawEnd.getTime(), incident.startedAt.getTime() + maxDuration)
    );

    const incStart = Math.max(incident.startedAt.getTime(), dayStart.getTime());
    const incEnd = Math.min(cappedEnd.getTime(), dayEnd.getTime());

    if (incStart >= incEnd) continue;

    dayIncidents.push({ start: incStart, end: incEnd, rank });
    edges.add(incStart);
    edges.add(incEnd);
  }

  if (dayIncidents.length === 0) return { score: 100, hours: 0, worst: 0 };

  // Sort edges chronologically
  const sortedEdges = Array.from(edges).sort((a, b) => a - b);

  let deduction = 0;
  let hours = 0;
  let worst = 0;

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
      hours += intervalHours;
      worst = Math.max(worst, maxRank);
    }
  }

  // Unrounded: scores keep full precision until display
  return { score: Math.max(SEVERITY_FLOOR[worst] ?? 0, 100 - deduction), hours, worst };
}

// Mean of the 7 day scores ending on `date` (inclusive). Callers score a date
// once it has ended, so every day in the window is complete.
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

  return total / 7;
}
