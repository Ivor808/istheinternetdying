export const AI_ERA_DATE = '2026-01-01';

// The AI Era line only means something as a before/after split, so it needs
// data on both sides of it. Dates are YYYY-MM-DD, sorted ascending.
export function hasDataAroundAiEra(dates: string[]): boolean {
  return dates.length > 0 && dates[0] < AI_ERA_DATE && dates[dates.length - 1] >= AI_ERA_DATE;
}

export type RangeKey = '30d' | '90d' | '1y' | 'all';

export const RANGE_PRESETS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null },
];

export const DEFAULT_RANGE: RangeKey = '1y';

// Above this span, daily lines are smoothed and only outages/major events get markers
export const WIDE_RANGE_DAYS = 120;
export const SMOOTHING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toTs(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

export function toDateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// "Mar 5, 2026"
export function formatDate(date: string): string {
  const d = new Date(toTs(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// "Mar 2026"
export function formatMonth(date: string): string {
  const d = new Date(toTs(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export interface RangeBounds {
  start: string;
  end: string;
}

// Range is anchored to the latest data point, not the wall clock
export function getRangeBounds(dates: string[], range: RangeKey): RangeBounds | null {
  if (dates.length === 0) return null;
  const first = dates[0];
  const end = dates[dates.length - 1];
  const preset = RANGE_PRESETS.find((p) => p.key === range);
  if (!preset || preset.days === null) return { start: first, end };
  const start = toDateStr(toTs(end) - preset.days * DAY_MS);
  return { start: start < first ? first : start, end };
}

export function rangeTitle(range: RangeKey, bounds: RangeBounds | null): string {
  switch (range) {
    case '30d':
      return 'Last 30 days';
    case '90d':
      return 'Last 90 days';
    case '1y':
      return 'Last 12 months';
    default:
      return bounds
        ? `${formatMonth(bounds.start)} to ${formatMonth(bounds.end)}`
        : 'All time';
  }
}

// Rows inside the range plus the last row before it, so lines reach the left edge
export function sliceToRange<T extends { date: string }>(rows: T[], bounds: RangeBounds): T[] {
  let firstIdx = rows.findIndex((r) => r.date >= bounds.start);
  if (firstIdx === -1) return [];
  if (firstIdx > 0 && rows[firstIdx].date > bounds.start) firstIdx -= 1;
  return rows.slice(firstIdx).filter((r) => r.date <= bounds.end);
}

// Monthly buckets (dated the 1st) that overlap the range at all
export function monthsInRange<T extends { date: string }>(rows: T[], bounds: RangeBounds): T[] {
  const startMonth = bounds.start.slice(0, 7);
  const endMonth = bounds.end.slice(0, 7);
  return rows.filter((r) => {
    const m = r.date.slice(0, 7);
    return m >= startMonth && m <= endMonth;
  });
}

// Trailing mean over the last `days` calendar days. Monthly points have no
// neighbours inside the window, so they pass through unchanged.
export function rollingMean(
  dates: string[],
  values: Array<number | undefined>,
  days: number
): Array<number | undefined> {
  const out: Array<number | undefined> = [];
  let start = 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < dates.length; i++) {
    const v = values[i];
    if (typeof v === 'number') {
      sum += v;
      count += 1;
    }
    const windowStart = toTs(dates[i]) - (days - 1) * DAY_MS;
    while (toTs(dates[start]) < windowStart) {
      const old = values[start];
      if (typeof old === 'number') {
        sum -= old;
        count -= 1;
      }
      start += 1;
    }
    out.push(typeof v === 'number' && count > 0 ? sum / count : undefined);
  }
  return out;
}

// Top pinned at 100; lower bound snapped to the tick step so it doesn't jitter
export function yAxisScale(values: number[]): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  const min = finite.length > 0 ? Math.min(...finite) : 100;
  const raw = Math.max(0, min - 3);
  const span = 100 - raw;
  const step = span <= 25 ? 5 : span <= 50 ? 10 : 20;
  const lower = Math.min(90, Math.max(0, Math.floor(raw / step) * step));
  const ticks: number[] = [];
  for (let t = lower; t <= 100; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== 100) ticks.push(100);
  return { domain: [lower, 100], ticks };
}

// Date-aligned ticks: weekly for short ranges, monthly, then quarterly
export function timeTicks(startTs: number, endTs: number): number[] {
  const spanDays = (endTs - startTs) / DAY_MS;
  if (spanDays <= 45) {
    const ticks: number[] = [];
    for (let t = startTs; t <= endTs; t += 7 * DAY_MS) ticks.push(t);
    return ticks;
  }
  const monthStep = spanDays <= 400 ? 1 : 3;
  const d = new Date(startTs);
  const y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  if (d.getUTCDate() !== 1 || d.getUTCHours() !== 0) m += 1;
  m = Math.ceil(m / monthStep) * monthStep;
  const ticks: number[] = [];
  for (;;) {
    const t = Date.UTC(y + Math.floor(m / 12), m % 12, 1);
    if (t > endTs) break;
    ticks.push(t);
    m += monthStep;
  }
  return ticks;
}

export function formatTick(ts: number, spanDays: number): string {
  const d = new Date(ts);
  const month = MONTHS[d.getUTCMonth()];
  if (spanDays <= 120) return `${month} ${d.getUTCDate()}`;
  return `${month} '${String(d.getUTCFullYear()).slice(2)}`;
}

export interface LabelCandidate {
  id: string;
  x: number;
  text: string;
  priority: number;
}

export interface PlacedLabel {
  row: number;
  cx: number;
  width: number;
}

// Greedy placement: highest priority first, lowest free row wins, otherwise dropped
export function layoutEventLabels(
  items: LabelCandidate[],
  opts: { rows: number; charWidth: number; gap: number; minX: number; maxX: number }
): Map<string, PlacedLabel> {
  const occupied: Array<Array<[number, number]>> = Array.from({ length: opts.rows }, () => []);
  const placed = new Map<string, PlacedLabel>();
  const sorted = [...items].sort((a, b) => b.priority - a.priority);
  for (const item of sorted) {
    const width = item.text.length * opts.charWidth;
    if (width > opts.maxX - opts.minX) continue;
    const cx = Math.min(Math.max(item.x, opts.minX + width / 2), opts.maxX - width / 2);
    const left = cx - width / 2 - opts.gap / 2;
    const right = cx + width / 2 + opts.gap / 2;
    for (let row = 0; row < opts.rows; row++) {
      if (occupied[row].every(([l, r]) => right <= l || left >= r)) {
        occupied[row].push([left, right]);
        placed.set(item.id, { row, cx, width });
        break;
      }
    }
  }
  return placed;
}
