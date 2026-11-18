import { getTodayCard } from './card';
import { formatDate } from './chart';
import { getDashboardData } from './dashboard';
import { getDay, getNotableDays } from './day';
import { daySummary, changeWords, headline, listNames, normalWord, TRACKED_SERVICES } from './day-text';
import { displayName, fameRank, toDeath } from './death';
import { EVENTS } from './events';
import { providerConfigs } from '../providers/config';
import { SITE_URL } from './site';

// The public JSON API and /llms.txt: the same numbers as the site, for scripts and AI assistants

const SCALE = '0-100, higher is worse';
const round1 = (n: number) => Math.round(n * 10) / 10;
const roundBand = (band: [number, number] | null) => (band ? [round1(band[0]), round1(band[1])] : null);

export async function todayJson() {
  const card = await getTodayCard();
  if (!card) return null;
  return {
    date: card.date,
    deathIndex: card.death,
    scale: SCALE,
    changeVsWeekBefore: card.delta,
    normalRange: roundBand(card.band),
    trackedServices: TRACKED_SERVICES,
    servicesWithIssuesNow: card.services.map((s) => ({ slug: s.slug, name: s.name })),
    url: `${SITE_URL}/`,
    dayUrl: `${SITE_URL}/day/${card.date}`,
    image: `${SITE_URL}/card/today.png`,
    methodology: `${SITE_URL}/methodology`,
  };
}

export async function dayJson(date: string) {
  const day = await getDay(date);
  if (!day) return null;
  return {
    date: day.date,
    summary: daySummary(day),
    headline: headline(day),
    deathIndex: Math.round(day.death),
    scale: SCALE,
    weekBefore: day.weekBefore === null ? null : Math.round(day.weekBefore),
    normalRange: roundBand(day.band),
    notable: day.notable,
    trackedServices: TRACKED_SERVICES,
    incidents: day.incidents.map((i) => ({
      service: i.name,
      slug: i.slug,
      title: i.title,
      severity: i.severity,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      hoursThatDay: round1(i.hours),
      statusPage: i.statusUrl,
    })),
    events: day.events.map((e) => ({ label: e.label, description: e.description ?? null, source: e.url ?? null })),
    url: `${SITE_URL}/day/${day.date}`,
    image: `${SITE_URL}/card/${day.date}.png`,
  };
}

const NOTABLE_LISTED = 30;

export async function llmsTxt(): Promise<string> {
  const [today, { history }, notable] = await Promise.all([todayJson(), getDashboardData(), getNotableDays()]);
  const famous = [...providerConfigs]
    .sort((a, b) => fameRank(a.slug) - fameRank(b.slug))
    .slice(0, 8)
    .map((p) => displayName(p.slug, p.name));
  const deathOn = new Map(history.map((h) => [h.date, Math.round(toDeath(h.globalScore))]));

  const lines = [
    '# Is The Internet Dying?',
    '',
    `> A daily reliability index for ${TRACKED_SERVICES} major internet services (${famous.join(', ')} and more), built from incidents on their public status pages. The Death Index runs from 0 to 100; higher is worse.`,
    '',
  ];

  if (today) {
    const parts = [`Death Index ${today.deathIndex}/100`];
    if (today.changeVsWeekBefore !== null) parts.push(`${changeWords(today.changeVsWeekBefore)} from a week earlier`);
    const normal = normalWord(today.deathIndex, today.normalRange as [number, number] | null);
    if (normal) parts.push(normal);
    const broken = today.servicesWithIssuesNow.map((s) => s.name);
    lines.push(
      `Latest (${formatDate(today.date)}): ${parts.join(', ')}. ` +
        (broken.length > 0
          ? `Reporting issues right now: ${listNames(broken.slice(0, 10))}${broken.length > 10 ? ` and ${broken.length - 10} more` : ''}.`
          : 'No tracked service is reporting issues right now.'),
      ''
    );
  }

  lines.push(
    '## Pages',
    '',
    `- [Dashboard](${SITE_URL}/): today's Death Index, services having issues now, 90 days of incidents by service, and the long-term trend`,
    `- [Methodology](${SITE_URL}/methodology): how status page incidents become a score, and what "normal" means`,
    `- Any scored day: ${SITE_URL}/day/YYYY-MM-DD, with every incident that day`,
    '',
    '## Data',
    '',
    `- [Today as JSON](${SITE_URL}/api/today.json)`,
    `- Any day as JSON: ${SITE_URL}/api/day/YYYY-MM-DD.json`,
    '',
    '## Notable days',
    '',
    ...notable
      .slice(-NOTABLE_LISTED)
      .reverse()
      .map((date) => {
        const events = EVENTS.filter((e) => e.date === date && (e.category === 'outage' || e.major)).map((e) => e.label);
        return `- [${formatDate(date)}](${SITE_URL}/day/${date}): Death Index ${deathOn.get(date) ?? '?'}${events.length ? ` · ${events.join(' · ')}` : ''}`;
      }),
    ''
  );
  return lines.join('\n');
}
