interface IncidentWindow {
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
}

const SEVERITY_POINTS_PER_HOUR: Record<string, number> = {
  minor: 5,
  major: 15,
  critical: 30,
};

export function computeSingleDayScore(
  incidents: IncidentWindow[],
  day: Date
): number {
  const dayStart = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  let deduction = 0;

  for (const incident of incidents) {
    const incStart = incident.startedAt;
    const incEnd = incident.resolvedAt ?? dayEnd;

    const overlapStart = new Date(Math.max(incStart.getTime(), dayStart.getTime()));
    const overlapEnd = new Date(Math.min(incEnd.getTime(), dayEnd.getTime()));

    if (overlapStart >= overlapEnd) continue;

    const overlapHours =
      (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
    const pointsPerHour = SEVERITY_POINTS_PER_HOUR[incident.severity] ?? 0;
    deduction += pointsPerHour * overlapHours;
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
