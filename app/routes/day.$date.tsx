import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { cardFromDay } from '@/data/card';
import { formatDate } from '@/data/chart';
import { getDay, type DayIncident } from '@/data/day';
import { daySummary, headline } from '@/data/day-text';
import { SITE_URL } from '@/data/site';
import { DeathCard } from '../components/DeathCard';
import { ShareMenu } from '../components/ShareMenu';
import { Logo } from '../components/Logo';

// One page per scored day: the score, what broke, and any event we track. Notable days are indexed.

const loadDay = createServerFn()
  .inputValidator((date: string) => date)
  .handler(async ({ data }) => {
    const day = await getDay(data);
    return day ? { day, card: cardFromDay(day) } : null;
  });

export const Route = createFileRoute('/day/$date')({
  loader: async ({ params }) => {
    const result = await loadDay({ data: params.date });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { day, card } = loaderData;
    const url = `${SITE_URL}/day/${day.date}`;
    const title = `${formatDate(day.date)}: ${headline(day)} — Death Index ${card.death}`;
    const description = daySummary(day);
    const image = `${SITE_URL}/card/${day.date}.png`;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        ...(day.notable ? [] : [{ name: 'robots', content: 'noindex' }]),
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: url },
        { property: 'og:image', content: image },
        { property: 'og:image:alt', content: `Death Index for ${formatDate(day.date)}` },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: image },
      ],
      links: [{ rel: 'canonical', href: url }],
    };
  },
  component: DayPage,
});

const SEVERITY_COLOR = { minor: '#8b8b96', major: '#ff8a5c', critical: '#ff4d4d' };

const time = (iso: string) => iso.slice(11, 16);

// "13:05–17:40", with dates when it runs past this day
function span(i: DayIncident, date: string): string {
  const startDay = i.startedAt.slice(0, 10);
  const start = startDay === date ? time(i.startedAt) : `${formatDate(startDay).replace(/, \d{4}$/, '')} ${time(i.startedAt)}`;
  if (!i.resolvedAt) return `${start}–ongoing`;
  const endDay = i.resolvedAt.slice(0, 10);
  const end = endDay === date ? time(i.resolvedAt) : `${formatDate(endDay).replace(/, \d{4}$/, '')} ${time(i.resolvedAt)}`;
  return `${start}–${end}`;
}

const hours = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : `${h.toFixed(1)}h`);

function DayPage() {
  const { day, card } = Route.useLoaderData();

  return (
    <div className="dp">
      <style dangerouslySetInnerHTML={{ __html: DP_CSS }} />
      <nav className="dp-wrap dp-nav">
        <Link to="/" className="dp-link">← {new URL(SITE_URL).host}</Link>
        <span className="dp-pager">
          {day.prev ? <Link to="/day/$date" params={{ date: day.prev }} className="dp-link">← {formatDate(day.prev)}</Link> : <span />}
          {day.next && <Link to="/day/$date" params={{ date: day.next }} className="dp-link">{formatDate(day.next)} →</Link>}
        </span>
      </nav>

      <header className="dp-wrap dp-hero">
        <div>
          <p className="dp-date">{formatDate(day.date)}</p>
          <h1 className="dp-h1">{headline(day)}</h1>
          <p className="dp-sub">{daySummary(day)}</p>
        </div>
        <DeathCard
          death={card.death}
          delta={card.delta}
          band={card.band}
          deltaLabel="vs week before"
          actions={
            <>
              <Link to="/methodology" className="dc-link">how it's scored</Link>
              <ShareMenu
                url={`${SITE_URL}/day/${day.date}`}
                imageUrl={`/card/${day.date}.png`}
                text={`${formatDate(day.date)}: the internet's Death Index hit ${card.death}/100.`}
              />
            </>
          }
        />
      </header>

      {day.events.length > 0 && (
        <section className="dp-wrap dp-section">
          <h2 className="dp-h2">What happened</h2>
          <ul className="dp-list">
            {day.events.map((e) => (
              <li key={e.label} className="dp-event">
                <b>{e.label}</b>
                {e.description && <span className="dp-muted"> {e.description}</span>}{' '}
                {e.url && (
                  <a className="dp-link" href={e.url} target="_blank" rel="noopener noreferrer">
                    source
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dp-wrap dp-section">
        <h2 className="dp-h2">
          Incidents <span className="dp-count">{day.incidents.length} · UTC</span>
        </h2>
        {day.incidents.length === 0 ? (
          <p className="dp-muted" style={{ marginTop: '0.75rem' }}>None of the services we track reported an incident.</p>
        ) : (
          <ul className="dp-list">
            {day.incidents.map((i) => (
              <li key={`${i.slug}-${i.startedAt}`} className="dp-incident">
                <span className="dp-service">
                  <Logo slug={i.slug} size={14} reserve />
                  {i.statusUrl ? (
                    <a href={i.statusUrl} target="_blank" rel="noopener noreferrer">{i.name}</a>
                  ) : (
                    i.name
                  )}
                </span>
                <span className="dp-title">{i.title}</span>
                <span className="dp-sev" style={{ color: SEVERITY_COLOR[i.severity] }}>{i.severity}</span>
                <span className="dp-time">
                  {span(i, day.date)} <span className="dp-muted">· {hours(i.hours)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="dp-wrap dp-footer">
        <Link to="/methodology" className="dp-link">methodology</Link>
        <span>Incident data from each provider's public status page.</span>
      </footer>
    </div>
  );
}

const DP_CSS = `
.dp { background: #0a0a0f; color: #ececf1; min-height: 100vh; -webkit-font-smoothing: antialiased; }
.dp-wrap { max-width: 1040px; margin: 0 auto; padding: 0 1.25rem; }
.dp-nav { display: flex; justify-content: space-between; gap: 1rem; padding-top: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid #1c1c24; font-size: 0.85rem; }
.dp-pager { display: flex; gap: 1.25rem; }
.dp-link { color: #8b8b96; text-decoration: none; }
.dp-link:hover { color: #ececf1; }
.dp-hero { display: grid; grid-template-columns: 1fr auto; gap: 2.5rem; align-items: center; margin-top: 3.5rem; }
.dp-date { font-family: ui-monospace, monospace; color: #8b8b96; font-size: 0.9rem; }
.dp-h1 { font-size: clamp(2rem, 5vw, 3.25rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin-top: 0.5rem; }
.dp-sub { margin-top: 0.9rem; font-size: 1.05rem; line-height: 1.55; color: #8b8b96; max-width: 38rem; }
.dp-section { margin-top: 4rem; }
.dp-h2 { font-size: 1.2rem; font-weight: 700; }
.dp-count { font-family: ui-monospace, monospace; font-size: 0.75rem; font-weight: 400; color: #8b8b96; margin-left: 0.5rem; }
.dp-muted { color: #8b8b96; }
.dp-list { list-style: none; margin-top: 0.75rem; border-top: 1px solid #1c1c24; }
.dp-event { padding: 0.9rem 0; border-bottom: 1px solid #1c1c24; line-height: 1.5; }
.dp-incident { display: grid; grid-template-columns: 9rem 1fr 5rem 12rem; gap: 1rem; align-items: baseline; padding: 0.7rem 0; border-bottom: 1px solid #1c1c24; font-size: 0.92rem; }
.dp-service a { color: #ececf1; text-decoration: underline dotted; text-underline-offset: 3px; }
.dp-service { font-weight: 600; display: inline-flex; align-items: center; gap: 0.45rem; }
.dp-sev, .dp-time { font-family: ui-monospace, monospace; font-size: 0.78rem; }
.dp-time { text-align: right; }
.dp-footer { margin-top: 4rem; padding-top: 1.5rem; padding-bottom: 2.5rem; border-top: 1px solid #1c1c24; color: #8b8b96; font-size: 0.8rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
@media (max-width: 720px) {
  .dp-hero { grid-template-columns: 1fr; gap: 1.75rem; margin-top: 2rem; }
  .dp-nav .dp-pager a:first-child { display: none; }
  .dp-incident { grid-template-columns: 1fr auto; gap: 0.2rem 1rem; }
  .dp-title { grid-column: 1 / -1; grid-row: 2; color: #8b8b96; }
  .dp-time { grid-column: 1 / -1; text-align: left; }
}
`;
