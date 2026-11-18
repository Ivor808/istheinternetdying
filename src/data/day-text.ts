import { providerConfigs } from '../providers/config';
import { formatDate } from './chart';
import type { DayData } from './day';

// Plain sentences about a day, for the page lead, its description, and anything quoting it.
// No database imports: the day page component uses this in the browser too.

export const TRACKED_SERVICES = providerConfigs.length;

// "A", "A and B", "A, B and C"
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function headline(day: Pick<DayData, 'events' | 'incidents'>): string {
  const big = day.events.filter((e) => e.category === 'outage' || e.major);
  if (big.length > 0) return big.map((e) => e.label).join(' · ');
  const n = new Set(day.incidents.map((i) => i.slug)).size;
  if (n === 0) return 'No incidents';
  return `${n} ${n === 1 ? 'service' : 'services'} had incidents`;
}

export function normalWord(death: number, band: [number, number] | null): string | null {
  if (!band) return null;
  if (death > band[1]) return 'above its normal range';
  if (death < band[0]) return 'below its normal range';
  return 'within its normal range';
}

export function changeWords(delta: number): string {
  return delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : 'unchanged';
}

const hoursText = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} minutes` : `${h.toFixed(1)} hours`);

export function daySummary(day: DayData): string {
  const date = formatDate(day.date);
  const death = Math.round(day.death);
  const names = [...new Map(day.incidents.map((i) => [i.slug, i.name])).values()];
  const sentences: string[] = [];

  if (names.length === 0) {
    sentences.push(`On ${date}, none of the ${TRACKED_SERVICES} services we track reported an incident.`);
  } else {
    const shown = names.length <= 3 ? `: ${listNames(names)}` : `, including ${listNames(names.slice(0, 3))}`;
    sentences.push(
      `On ${date}, ${names.length} of the ${TRACKED_SERVICES} services we track reported incidents${shown}.`
    );
    const longest = day.incidents.reduce((a, b) => (b.hours > a.hours ? b : a));
    sentences.push(`The longest was ${longest.name}'s "${longest.title}", open ${hoursText(longest.hours)} that day.`);
  }

  const index = [`The Death Index was ${death}/100 (higher is worse)`];
  if (day.weekBefore !== null) index.push(`${changeWords(death - Math.round(day.weekBefore))} from a week earlier`);
  const normal = normalWord(death, day.band);
  if (normal) index.push(normal);
  sentences.push(`${index.join(', ')}.`);

  return sentences.join(' ');
}
