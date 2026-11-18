import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Cell,
  type TooltipContentProps,
} from 'recharts';
import { getDashboardData, getServiceGrid, type DashboardData } from '@/data/dashboard';
import { LIVE_TTL_MS, getLiveStatus, isIssue, type LiveStatus } from '@/data/live-status';
import type { ServiceGrid as Grid } from '@/data/service-grid';
import { providerConfigs } from '@/providers/config';
import { displayName, fameRank, formatDelta, normalBand, toDeath } from '@/data/death';
import {
  AI_ERA_DATE,
  SMOOTHING_DAYS,
  WIDE_RANGE_DAYS,
  formatDate,
  formatMonth,
  formatTick,
  getRangeBounds,
  hasDataAroundAiEra,
  monthsInRange,
  rollingMean,
  sliceToRange,
  timeTicks,
  toTs,
  type RangeKey,
} from '@/data/chart';
import { EVENTS, EVENT_CATEGORY_COLORS, eventId, type TimelineEvent } from '@/data/events';
import { CATEGORY_COLORS, CATEGORY_NAMES, EventLayer } from '../components/TrendChart';
import { GRID_SCALE, ServiceGrid } from '../components/ServiceGrid';
import { DeathCard } from '../components/DeathCard';
import { ShareMenu } from '../components/ShareMenu';
import { Logo } from '../components/Logo';
import { logoPath } from '@/data/logos';
import { SITE_URL } from '@/data/site';

// Proof of concept for a data-first layout. Not linked from the main page and not indexed.

const loadPage = createServerFn().handler(async () => {
  const [dashboard, grid, live] = await Promise.all([getDashboardData(), getServiceGrid(), getLiveStatus()]);
  return { dashboard, grid, live };
});

const loadLive = createServerFn().handler(async () => getLiveStatus());

// Keeps the live status fresh while the tab is visible
function useLiveStatus(initial: LiveStatus): LiveStatus {
  const [live, setLive] = useState(initial);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadLive().then(setLive).catch(() => {});
    };
    const id = window.setInterval(tick, LIVE_TTL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return live;
}

const fmtTime = (iso: string) => `${iso.slice(11, 16)} UTC`;

type Presence = 'stable' | 'new' | 'leaving';

// Lets the "having issues" pills animate when a live check adds or clears a service.
// Nothing animates on first render; removed items linger briefly so they can fade out.
function usePresence<T extends { slug: string }>(items: T[]): Array<{ item: T; state: Presence }> {
  const [shown, setShown] = useState(() => items.map((item) => ({ item, state: 'stable' as Presence })));
  const latest = useRef(items);
  const key = items.map((i) => i.slug).join(',');
  useEffect(() => {
    latest.current = items;
  });
  useEffect(() => {
    const current = latest.current;
    const slugs = new Set(current.map((i) => i.slug));
    setShown((prev) => {
      const before = new Map(prev.filter((p) => p.state !== 'leaving').map((p) => [p.item.slug, p.state]));
      const kept = current.map((item) => ({ item, state: (before.get(item.slug) ?? 'new') as Presence }));
      const gone = prev.filter((p) => !slugs.has(p.item.slug)).map((p) => ({ ...p, state: 'leaving' as Presence }));
      return [...kept, ...gone];
    });
    const t = window.setTimeout(() => setShown((prev) => prev.filter((p) => p.state !== 'leaving')), 450);
    return () => window.clearTimeout(t);
  }, [key]);
  return shown;
}

export const Route = createFileRoute('/v2')({
  loader: async () => loadPage(),
  head: ({ loaderData }) => {
    const latest = loaderData?.dashboard.current?.date;
    const image = `${SITE_URL}/card/today.png${latest ? `?v=${latest}` : ''}`;
    return {
      meta: [
        { title: 'Is The Internet Dying? — new layout preview' },
        { name: 'robots', content: 'noindex, nofollow' },
        { property: 'og:image', content: image },
        { name: 'twitter:image', content: image },
        { property: 'og:image:alt', content: "Today's Death Index and the services having issues right now" },
      ],
    };
  },
  component: V2,
});

type History = DashboardData['history'];

const C = {
  bg: '#0a0a0f',
  text: '#ececf1',
  muted: '#8b8b96',
  faint: '#2a2a33',
  line: '#1c1c24',
  bad: '#ff4d4d',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
];

const CATEGORY_ORDER = ['cloud-infra', 'ai', 'dev-tools', 'productivity', 'comms', 'fintech'];

const STATUS_URL = new Map(providerConfigs.map((p) => [p.slug, p.statusPageUrl]));

// 0-based axis so small moves don't look like cliffs
function deathAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const max = Math.max(10, ...values.filter((v) => Number.isFinite(v)));
  const step = max <= 20 ? 5 : max <= 50 ? 10 : 20;
  const top = Math.min(100, Math.ceil((max * 1.05) / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { domain: [0, top], ticks };
}

// Even thousands for the CVE bars
function countAxis(max: number): number[] {
  const step = [500, 1000, 2000, 2500, 5000, 10000].find((s) => max / s <= 4) ?? 20000;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step - 1; t += step) ticks.push(t);
  return ticks;
}

// "▲27% vs avg", or nothing when there's no baseline
function vsAvg(value: number, avg: number | null): string | undefined {
  if (avg === null || avg === 0) return undefined;
  const pct = Math.round(((value - avg) / avg) * 100);
  if (pct === 0) return 'same as avg';
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs avg`;
}

interface WeekStats {
  hours: number;
  hit: number;
  avgHours: number | null;
  avgHit: number | null;
}

// Last 7 days vs the average of the earlier full weeks in the grid
function weekStats(services: Grid['services'], dayCount: number): WeekStats {
  const windowStats = (from: number, to: number) => {
    let hours = 0;
    let hit = 0;
    for (const s of services) {
      const h = s.hours.slice(from, to).reduce((a, b) => a + b, 0);
      hours += h;
      if (h > 0) hit += 1;
    }
    return { hours, hit };
  };
  const now = windowStats(dayCount - 7, dayCount);
  const past: Array<{ hours: number; hit: number }> = [];
  for (let end = dayCount - 7; end - 7 >= 0; end -= 7) past.push(windowStats(end - 7, end));
  const avg = (k: 'hours' | 'hit') =>
    past.length > 0 ? past.reduce((a, w) => a + w[k], 0) / past.length : null;
  return { ...now, avgHours: avg('hours'), avgHit: avg('hit') };
}

function V2() {
  const { dashboard: data, grid: syncedGrid, live: initialLive } = Route.useLoaderData();
  const live = useLiveStatus(initialLive);
  // Trust the live check unless most status pages failed to answer
  const liveOk = live.failed <= live.services.length / 2;
  const liveIssues = useMemo(
    () => (liveOk ? live.services.filter((s) => isIssue(s.indicator)) : []),
    [live, liveOk]
  );
  // "Open now" outlines on the grid follow the live check when we have one
  const grid = useMemo(() => {
    const open = liveOk ? new Set(liveIssues.map((s) => s.slug)) : null;
    return {
      ...syncedGrid,
      services: syncedGrid.services.map((s) => ({
        ...s,
        name: displayName(s.slug, s.name),
        openNow: open ? open.has(s.slug) : s.openNow,
      })),
    };
  }, [syncedGrid, liveOk, liveIssues]);
  const history = data.history;
  const current = history[history.length - 1];
  const weekAgo = data.previous ? history.find((h) => h.date === data.previous!.date) : undefined;

  const spanAll = history.length > 1 ? (toTs(history[history.length - 1].date) - toTs(history[0].date)) / 86400000 : 0;
  // Only offer ranges the data can fill; "All" names its start when it's under a year
  const ranges = RANGES.filter((r) => (r.key === '1y' ? spanAll > 365 : r.key === '90d' ? spanAll > 90 : true)).map((r) =>
    r.key === 'all' && spanAll <= 365 && history.length > 0 ? { ...r, label: `since ${formatMonth(history[0].date)}` } : r
  );
  const [range, setRange] = useState<RangeKey>(spanAll > 365 ? '1y' : 'all');
  const [eventScope, setEventScope] = useState<'outage' | 'all'>('outage');
  const [overlays, setOverlays] = useState<Set<string>>(new Set());
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);

  const latestTs = current ? toTs(current.date) : 0;
  const scoredDates = useMemo(() => new Set(history.map((h) => h.date)), [history]);
  const dayCount = grid.days.length;

  const week = useMemo(() => weekStats(grid.services, dayCount), [grid.services, dayCount]);
  const incidentsThisWeek = grid.services.reduce((a, s) => a + s.incidentsThisWeek, 0);
  const openNow = grid.services.filter((s) => s.openNow).sort((a, b) => fameRank(a.slug) - fameRank(b.slug));
  const liveBySlug = new Map(live.services.map((s) => [s.slug, s]));
  const chips = usePresence(openNow);

  const categoryWeek = useMemo(
    () =>
      Object.fromEntries(
        CATEGORY_ORDER.map((cat) => {
          const services = grid.services.filter((s) => s.category === cat);
          return [cat, { ...weekStats(services, dayCount), total: services.length }];
        })
      ),
    [grid.services, dayCount]
  );

  // Chart
  const bounds = useMemo(() => getRangeBounds(history.map((h) => h.date), range), [history, range]);
  const startTs = bounds ? toTs(bounds.start) : 0;
  const endTs = bounds ? toTs(bounds.end) : 0;
  const spanDays = (endTs - startTs) / 86400000;
  const smooth = spanDays > WIDE_RANGE_DAYS;
  const deathBand = useMemo(() => normalBand(history.map((h) => toDeath(h.globalScore))), [history]);

  const chartData = useMemo(() => {
    if (!bounds) return [];
    const dates = history.map((h) => h.date);
    const idx = new Map(dates.map((d, i) => [d, i]));
    const series = new Map(
      ['global', ...overlays].map((k) => {
        const raw = history.map((h) => toDeath(k === 'global' ? h.globalScore : h.categoryScores[k]));
        return [k, smooth ? rollingMean(dates, raw, SMOOTHING_DAYS) : raw];
      })
    );
    return sliceToRange(history, bounds).map((h) => {
      const row: Record<string, number | string | undefined> = { ts: toTs(h.date), date: h.date };
      for (const [k, v] of series) row[k] = v[idx.get(h.date)!];
      return row;
    });
  }, [history, bounds, overlays, smooth]);

  const yScale = useMemo(
    () =>
      deathAxis([
        ...chartData.flatMap((r) =>
          ['global', ...overlays].map((k) => r[k]).filter((v): v is number => typeof v === 'number')
        ),
        ...(deathBand ? [deathBand[1]] : []),
      ]),
    [chartData, overlays, deathBand]
  );

  const chartEvents = useMemo(
    () =>
      bounds
        ? EVENTS.filter(
            (e) =>
              e.date >= bounds.start &&
              e.date <= bounds.end &&
              (e.category === 'outage' || eventId(e) === activeEventId)
          )
        : [],
    [bounds, activeEventId]
  );

  const feed = useMemo(
    () =>
      [...EVENTS]
        .filter((e) => toTs(e.date) <= latestTs && (eventScope === 'all' || e.category === 'outage'))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [latestTs, eventScope]
  );

  const toggleOverlay = (cat: string) =>
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  // One line of fact for the hook: open incidents first, then an unusual week, then the plain count
  const fact =
    openNow.length > 0 ? (
      <>
        <b style={{ color: C.bad }}>{openNow.length}</b> {openNow.length === 1 ? 'service' : 'services'}{' '}
        {liveOk
          ? `${openNow.length === 1 ? 'is' : 'are'} having issues right now.`
          : `${openNow.length === 1 ? 'was' : 'were'} having issues at the last sync.`}
      </>
    ) : week.avgHours !== null && week.avgHours > 0 && week.hours > week.avgHours * 1.2 ? (
      <>
        <b style={{ color: C.bad }}>{(week.hours / week.avgHours).toFixed(1)}×</b> the downtime of a normal week.
      </>
    ) : (
      <>
        <b>{incidentsThisWeek}</b> incidents across <b>{week.hit}</b> services this week.
      </>
    );

  const cve = useMemo(() => {
    const currentMonth = current?.date.slice(0, 7) ?? '';
    const full = data.cveCounts.filter((m) => m.date.slice(0, 7) < currentMonth);
    const last = full[full.length - 1];
    if (!last) return null;
    const yearAgoKey = `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4, 7)}`;
    const yearAgo = full.find((m) => m.date.slice(0, 7) === yearAgoKey);
    const trailing = full.slice(-13, -1);
    return {
      last,
      currentMonth,
      change: yearAgo && yearAgo.count > 0 ? (last.count - yearAgo.count) / yearAgo.count : null,
      avg12: trailing.length > 0 ? trailing.reduce((a, m) => a + m.count, 0) / trailing.length : null,
    };
  }, [data.cveCounts, current]);

  const cveData = useMemo(
    () =>
      bounds
        ? monthsInRange(data.cveCounts, bounds).map((m) => ({
            ...m,
            partial: m.date.slice(0, 7) === cve?.currentMonth,
          }))
        : [],
    [data.cveCounts, bounds, cve]
  );

  const aiEraTs = toTs(AI_ERA_DATE);
  const deathNow = current ? Math.round(100 - current.globalScore) : null;
  const indexDelta = deathNow !== null && weekAgo ? deathNow - Math.round(100 - weekAgo.globalScore) : null;
  const cveTicks = useMemo(() => countAxis(Math.max(0, ...cveData.map((m) => m.count))), [cveData]);

  return (
    <div className="v2" style={{ background: C.bg, color: C.text, fontFamily: C.sans, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: V2_CSS }} />

      <nav className="v2-wrap v2-nav">
        <span style={{ fontFamily: C.mono, fontSize: '0.8rem', color: C.muted, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {liveOk ? (
            <>
              <span className="v2-live" style={{ width: 7, height: 7 }} />
              live · checked {fmtTime(live.checkedAt)}
            </>
          ) : (
            <>last sync {grid.syncedAt ? `${formatDate(grid.syncedAt.slice(0, 10))} ${fmtTime(grid.syncedAt)}` : 'unknown'}</>
          )}
        </span>
        <span style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
          <Link to="/methodology" className="v2-link">methodology</Link>
          <a className="v2-link" href="https://github.com/Ivor808/istheinternetdying" target="_blank" rel="noopener noreferrer">github</a>
          <Link to="/" className="v2-link">classic view</Link>
        </span>
      </nav>

      {/* 1. The answer: one focal point */}
      <header className="v2-wrap v2-hero">
        <div>
          <h1 className="v2-h1">
            Is the internet dying<span style={{ color: C.bad }}>?</span>
          </h1>
          <p className="v2-fact">{fact}</p>
          {chips.length > 0 && (
            <ul className="v2-open">
              {chips.map(({ item: s, state: presence }) => {
                const state = liveOk ? liveBySlug.get(s.slug)?.indicator : undefined;
                const severe = state === 'major' || state === 'critical';
                return (
                  <li key={s.slug} className={presence === 'stable' ? undefined : `is-${presence}`}>
                    <a className="v2-chip" href={STATUS_URL.get(s.slug)} target="_blank" rel="noopener noreferrer">
                      {logoPath(s.slug) ? (
                        <Logo slug={s.slug} size={14} />
                      ) : (
                        <span className="v2-live" style={{ width: 7, height: 7, opacity: severe ? 1 : 0.7 }} />
                      )}
                      {s.name}
                      {severe && <span style={{ color: C.bad }}>{state}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DeathCard
          death={deathNow}
          delta={indexDelta}
          band={deathBand}
          actions={
            <>
              <Link to="/methodology" className="dc-link">how it's scored</Link>
              {deathNow !== null && (
                <ShareMenu
                  url={SITE_URL}
                  imageUrl={`/card/today.png?v=${current?.date}`}
                  text={`The internet's Death Index is ${deathNow}/100${indexDelta ? ` (${formatDelta(indexDelta)} this week)` : ''}.`}
                />
              )}
            </>
          }
        />
      </header>

      {/* 2. What's breaking: the grid, with this week's numbers as its caption */}
      <section className="v2-wrap v2-section v2-section-first">
        <div className="v2-section-head">
          <h2 className="v2-h2">Last 90 days</h2>
          <div className="v2-inline">
            <span className="v2-inline-label">this week</span>
            <span><b>{incidentsThisWeek}</b> incidents</span>
            <span>
              <b>{week.hit}/{grid.services.length}</b> services
              <Change text={vsAvg(week.hit, week.avgHit)} bad={week.avgHit !== null && week.hit > week.avgHit * 1.2} />
            </span>
            <span>
              <b>{Math.round(week.hours)}h</b> down
              <Change text={vsAvg(week.hours, week.avgHours)} bad={week.avgHours !== null && week.hours > week.avgHours * 1.2} />
            </span>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <ServiceGrid grid={grid} />
        </div>
        <div className="v2-legend">
          <span>none</span>
          <i style={{ background: '#16161d' }} />
          {GRID_SCALE.map((c) => <i key={c} style={{ background: c }} />)}
          <span>severe</span>
          <span style={{ marginLeft: '1rem' }}>
            <i style={{ background: 'none', border: `1.2px solid ${C.bad}` }} /> open now{liveOk && ' (live)'}
          </span>
        </div>
      </section>

      {/* Categories */}
      <section className="v2-wrap v2-section">
        <div className="v2-section-head">
          <h2 className="v2-h2">By category</h2>
          {overlays.size > 0 && (
            <button className="v2-seg" onClick={() => setOverlays(new Set())}>
              clear
            </button>
          )}
        </div>
        <div className="v2-grid">
          {CATEGORY_ORDER.filter((cat) => current && cat in current.categoryScores).map((cat) => (
            <CategoryTile
              key={cat}
              cat={cat}
              history={history}
              score={Math.round(100 - current.categoryScores[cat])}
              delta={
                weekAgo && weekAgo.categoryScores[cat] !== undefined
                  ? Math.round(100 - current.categoryScores[cat]) - Math.round(100 - weekAgo.categoryScores[cat])
                  : null
              }
              week={categoryWeek[cat]}
              active={overlays.has(cat)}
              onToggle={() => toggleOverlay(cat)}
            />
          ))}
        </div>
      </section>

      {/* 3. Context: categories, trend, events, vulnerabilities */}
      <section className="v2-wrap v2-section">
        <div className="v2-section-head">
          <h2 className="v2-h2">
            Death Index{smooth && <span className="v2-unit"> {SMOOTHING_DAYS}-day avg</span>}
          </h2>
          <div role="group" aria-label="Time range" style={{ display: 'flex', gap: '0.25rem' }}>
            {ranges.map((r) => (
              <button
                key={r.key}
                className={`v2-seg${range === r.key ? ' is-active' : ''}`}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 42, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="v2-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.line} vertical={false} />
              {deathBand && (
                <ReferenceArea
                  y1={deathBand[0]}
                  y2={deathBand[1]}
                  fill="#ffffff"
                  fillOpacity={0.05}
                  stroke="none"
                  label={{ value: 'normal', position: 'insideRight', fill: C.muted, fontSize: 10 }}
                />
              )}
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={[startTs, endTs]}
                allowDataOverflow
                ticks={timeTicks(startTs, endTs)}
                tickFormatter={(ts: number) => formatTick(ts, spanDays)}
                stroke={C.faint}
                tick={{ fontSize: 11, fill: C.muted }}
                minTickGap={40}
              />
              <YAxis
                domain={yScale.domain}
                ticks={yScale.ticks}
                allowDataOverflow
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: C.muted }}
                width={32}
              />
              <Tooltip content={(p) => <ChartTip {...p} />} cursor={{ stroke: '#555', strokeDasharray: '2 3' }} />
              {aiEraTs > startTs && aiEraTs <= endTs && hasDataAroundAiEra(history.map((h) => h.date)) && (
                <ReferenceLine
                  x={aiEraTs}
                  stroke="#555"
                  strokeDasharray="4 4"
                  label={{ value: 'AI era', fill: C.muted, fontSize: 10, position: 'insideBottomLeft' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="global"
                name="Death Index"
                stroke={C.text}
                strokeWidth={2}
                fill="url(#v2-fill)"
                isAnimationActive={false}
                activeDot={{ r: 4, fill: C.text, stroke: C.bg }}
              />
              {[...overlays].map((cat) => (
                <Line
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  name={CATEGORY_NAMES[cat] ?? cat}
                  stroke={CATEGORY_COLORS[cat] ?? '#888'}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              <EventLayer
                events={chartEvents}
                activeId={activeEventId}
                onHover={setActiveEventId}
                onSelect={(id) => setActiveEventId((prev) => (prev === id ? null : id))}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Events */}
      <section className="v2-wrap v2-section">
        <div className="v2-section-head">
          <h2 className="v2-h2">Events</h2>
          <div role="group" aria-label="Event types" style={{ display: 'flex', gap: '0.25rem' }}>
            {(['outage', 'all'] as const).map((k) => (
              <button
                key={k}
                className={`v2-seg${eventScope === k ? ' is-active' : ''}`}
                aria-pressed={eventScope === k}
                onClick={() => setEventScope(k)}
              >
                {k === 'outage' ? 'Outages' : 'Everything'}
              </button>
            ))}
          </div>
        </div>
        <ol style={{ listStyle: 'none', marginTop: '0.75rem', borderTop: `1px solid ${C.line}` }}>
          {(showAllEvents ? feed : feed.slice(0, 6)).map((e) => (
            <FeedItem
              key={eventId(e)}
              event={e}
              active={eventId(e) === activeEventId}
              onHover={(on) => setActiveEventId(on ? eventId(e) : null)}
              hasDay={scoredDates.has(e.date)}
            />
          ))}
        </ol>
        {feed.length > 6 && (
          <button className="v2-seg" style={{ marginTop: '0.75rem' }} onClick={() => setShowAllEvents((v) => !v)}>
            {showAllEvents ? 'fewer' : `all ${feed.length}`}
          </button>
        )}
      </section>

      {/* Vulnerabilities, same range as the index */}
      {cveData.length > 0 && (
        <section className="v2-wrap v2-section">
          <div className="v2-section-head">
            <h2 className="v2-h2">
              New vulnerabilities<span className="v2-unit"> CVEs per month · NVD</span>
            </h2>
            {cve && (
              <div className="v2-inline">
                <span>
                  <b>{cve.last.count.toLocaleString()}</b> in {formatDate(cve.last.date).split(' ')[0]}
                  {cve.change !== null && (
                    <Change
                      text={`${cve.change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(cve.change * 100))}% vs last year`}
                      bad={cve.change > 0}
                    />
                  )}
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cveData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={C.faint}
                  tick={{ fontSize: 11, fill: C.muted }}
                  tickFormatter={(d: string) => formatTick(toTs(d), spanDays > 120 ? 365 : 60)}
                  minTickGap={40}
                />
                <defs>
                  <pattern id="v2-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="4" height="4" fill="#2a2a33" />
                    <line x1="0" y1="0" x2="0" y2="4" stroke="#5a5a66" strokeWidth="1.5" />
                  </pattern>
                </defs>
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: C.muted }}
                  width={36}
                  domain={[0, cveTicks[cveTicks.length - 1]]}
                  ticks={cveTicks}
                  tickFormatter={(v: number) => (v === 0 ? '0' : `${v % 1000 === 0 ? v / 1000 : (v / 1000).toFixed(1)}k`)}
                />
                <Tooltip
                  cursor={{ fill: '#ffffff', fillOpacity: 0.04 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const m = payload[0].payload as { date: string; count: number; partial: boolean };
                    return (
                      <div style={{ background: '#14141b', border: `1px solid ${C.faint}`, borderRadius: 6, padding: '0.35rem 0.55rem', fontFamily: C.mono, fontSize: '0.75rem' }}>
                        <div style={{ color: C.muted }}>{formatTick(toTs(m.date), 365)}{m.partial && ' · so far'}</div>
                        <div style={{ color: C.text }}>{m.count.toLocaleString()} CVEs</div>
                      </div>
                    );
                  }}
                />
                {cve?.avg12 != null && (
                  <ReferenceLine
                    y={cve.avg12}
                    stroke="#555"
                    strokeDasharray="4 4"
                    label={{ value: '12-mo avg', position: 'insideTopRight', fill: C.muted, fontSize: 10 }}
                  />
                )}
                <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                  {cveData.map((m) => (
                    <Cell key={m.date} fill={m.partial ? 'url(#v2-hatch)' : '#5a5a66'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <footer className="v2-wrap v2-footer">
        <span>
          <Link to="/methodology" className="v2-link">methodology</Link> ·{' '}
          <Link to="/" className="v2-link">classic view</Link> ·{' '}
          <a className="v2-link" href="https://ko-fi.com/ivorz" target="_blank" rel="noopener noreferrer">support</a>
        </span>
        <span>Independent project. Not affiliated with any listed provider.</span>
      </footer>
    </div>
  );
}

function Change({ text, bad }: { text: string | undefined; bad: boolean }) {
  if (!text) return null;
  return (
    <span className="v2-change" style={{ color: bad ? C.bad : C.muted }}>
      {text}
    </span>
  );
}

function ChartTip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as { date: string };
  return (
    <div style={{ background: '#14141b', border: `1px solid ${C.faint}`, borderRadius: 6, padding: '0.35rem 0.55rem', fontFamily: C.mono, fontSize: '0.75rem' }}>
      <div style={{ color: C.muted }}>{formatDate(row.date)}</div>
      {payload.map((p) =>
        typeof p.value === 'number' ? (
          <div key={String(p.dataKey)} style={{ color: p.dataKey === 'global' ? C.text : p.color }}>
            {p.name} {Math.round(p.value)}
          </div>
        ) : null
      )}
    </div>
  );
}

function CategoryTile({
  cat,
  history,
  score,
  delta,
  week,
  active,
  onToggle,
}: {
  cat: string;
  history: History;
  score: number;
  delta: number | null;
  week: WeekStats & { total: number };
  active: boolean;
  onToggle: () => void;
}) {
  const color = CATEGORY_COLORS[cat] ?? '#888';
  const { spark, band } = useMemo(() => {
    const last = history[history.length - 1];
    if (!last) return { spark: [], band: null };
    const from = toTs(last.date) - 90 * 86400000;
    const recent = history.filter((h) => toTs(h.date) >= from);
    const earlier = history.filter((h) => toTs(h.date) < from);
    const smoothed = rollingMean(recent.map((h) => h.date), recent.map((h) => toDeath(h.categoryScores[cat])), 3);
    return {
      spark: recent.map((h, i) => ({ ts: toTs(h.date), v: smoothed[i] })),
      band: normalBand((earlier.length >= 8 ? earlier : history).map((h) => toDeath(h.categoryScores[cat]))),
    };
  }, [history, cat]);

  const worse = week.avgHours !== null && week.hours > week.avgHours * 1.2;

  return (
    <button
      className={`v2-tile${active ? ' is-active' : ''}`}
      style={{ borderColor: active ? color : undefined }}
      aria-pressed={active}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: C.muted, fontSize: '0.85rem' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 6 }} />
          {CATEGORY_NAMES[cat] ?? cat}
        </span>
        {delta !== null && delta !== 0 && (
          <span style={{ fontFamily: C.mono, fontSize: '0.75rem', color: delta > 0 ? C.bad : C.muted }}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
        <span style={{ fontFamily: C.mono, fontSize: '1.75rem', fontWeight: 700, color: C.text }}>
          {score}
        </span>
        <span style={{ fontFamily: C.mono, fontSize: '0.75rem', color: worse ? C.bad : C.muted }}>
          {Math.round(week.hours)}h down · {week.hit}/{week.total} services
        </span>
      </div>
      <div style={{ height: 44, marginTop: '0.25rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spark} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
            <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
            {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="#ffffff" fillOpacity={0.06} stroke="none" ifOverflow="hidden" />}
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
}

function FeedItem({
  event,
  active,
  onHover,
  hasDay,
}: {
  event: TimelineEvent;
  active: boolean;
  onHover: (on: boolean) => void;
  hasDay: boolean;
}) {
  const outage = event.category === 'outage';
  return (
    <li
      className={`v2-feed${active ? ' is-active' : ''}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <span style={{ fontFamily: C.mono, fontSize: '0.8rem', color: C.muted, paddingTop: '0.15rem' }}>
        {hasDay ? (
          <Link to="/day/$date" params={{ date: event.date }} className="v2-link v2-daylink">
            {formatDate(event.date)}
          </Link>
        ) : (
          formatDate(event.date)
        )}
      </span>
      <div>
        <div style={{ fontWeight: outage || event.major ? 600 : 400 }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: outage ? C.bad : EVENT_CATEGORY_COLORS[event.category],
              opacity: outage ? 1 : 0.6,
              marginRight: 8,
              verticalAlign: 'middle',
            }}
          />
          {event.label}
        </div>
        {event.description && (
          <div style={{ color: C.muted, fontSize: '0.9rem', marginTop: '0.2rem', lineHeight: 1.45 }}>
            {event.description}{' '}
            {event.url && (
              <a className="v2-link" href={event.url} target="_blank" rel="noopener noreferrer">
                source
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

const V2_CSS = `
.v2 { -webkit-font-smoothing: antialiased; }
.v2-wrap { max-width: 1040px; margin: 0 auto; padding: 0 1.25rem; }
.v2-nav { display: flex; justify-content: space-between; align-items: center; padding-top: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid ${C.line}; }
.v2-link { color: ${C.muted}; text-decoration: none; }
.v2-link:hover { color: ${C.text}; }
.v2-daylink { text-decoration: underline dotted; text-underline-offset: 3px; }
.v2-hero { display: grid; grid-template-columns: 1fr auto; gap: 2.5rem; align-items: center; margin-top: 4rem; }
.v2-h1 { font-size: clamp(2.5rem, 7vw, 4.25rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
.v2-fact { font-size: clamp(1.1rem, 2.6vw, 1.4rem); margin-top: 1rem; color: ${C.text}; }
.v2-fact b { font-family: ${C.mono}; }
.v2-open { list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.9rem; }
.v2-chip { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.3rem 0.65rem; border: 1px solid ${C.faint}; border-radius: 999px; background: #101016; color: ${C.text}; text-decoration: none; font-size: 0.85rem; }
.v2-chip:hover { border-color: #444; }
/* Only opacity and transform animate: the red ring is a separate layer that fades out */
.v2-chip { position: relative; }
.v2-chip::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; border: 1px solid ${C.bad}; box-shadow: 0 0 0 3px rgba(255,77,77,0.3); opacity: 0; pointer-events: none; }
.v2-open li.is-new .v2-chip { animation: v2-chip-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
.v2-open li.is-new .v2-chip::after { animation: v2-ring 1.6s ease-out both; }
.v2-open li.is-leaving { animation: v2-chip-out 0.4s ease-in both; }
@keyframes v2-chip-in { from { opacity: 0; transform: translateY(4px) scale(0.96); } }
@keyframes v2-ring { 0%, 30% { opacity: 1; } 100% { opacity: 0; } }
@keyframes v2-chip-out { to { opacity: 0; transform: scale(0.92); } }
@media (prefers-reduced-motion: reduce) {
  .v2-open li.is-new .v2-chip, .v2-open li.is-new .v2-chip::after, .v2-open li.is-leaving, .v2-live { animation: none; }
}
.v2-chip span:last-child:not(.v2-live) { font-family: ${C.mono}; font-size: 0.7rem; }
.v2-section { margin-top: 5rem; }
.v2-section-first { margin-top: 4rem; padding-top: 2.5rem; border-top: 1px solid ${C.line}; }
.v2-inline { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.35rem 1.25rem; font-family: ${C.mono}; font-size: 0.8rem; color: ${C.muted}; }
.v2-inline b { color: ${C.text}; font-weight: 600; font-size: 0.95rem; }
.v2-inline-label { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.7rem; }
.v2-change { margin-left: 0.4rem; font-size: 0.75rem; }
.grid-filters { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.v2-live { width: 9px; height: 9px; border-radius: 50%; background: ${C.bad}; align-self: center; animation: v2-pulse 1.6s ease-in-out infinite; }
/* The grid outline stays still: animating inside a large SVG repaints all of it every frame */
@keyframes v2-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.v2-legend { display: flex; align-items: center; justify-content: flex-end; gap: 3px; font-family: ${C.mono}; font-size: 0.7rem; color: ${C.muted}; margin-top: 0.5rem; }
.v2-legend span { margin: 0 0.35rem; display: inline-flex; align-items: center; gap: 0.35rem; }
.v2-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
.v2-section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
.v2-h2 { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; }
.v2-unit { font-family: ${C.mono}; font-size: 0.75rem; font-weight: 400; color: ${C.muted}; margin-left: 0.5rem; }
.v2-seg { background: none; border: 1px solid transparent; color: ${C.muted}; font: inherit; font-family: ${C.mono}; font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 6px; cursor: pointer; }
.v2-seg:hover { color: ${C.text}; }
.v2-seg.is-active { color: ${C.text}; border-color: ${C.faint}; background: #14141b; }
.v2-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-top: 0.75rem; }
.v2-tile { text-align: left; background: #101016; border: 1px solid ${C.line}; border-radius: 10px; padding: 0.9rem 1rem 0.5rem; color: inherit; font: inherit; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.v2-tile:hover { border-color: ${C.faint}; }
.v2-tile.is-active { background: #14141c; }
.v2-feed { display: grid; grid-template-columns: 8.5rem 1fr; gap: 1rem; padding: 0.9rem 0.5rem; border-bottom: 1px solid ${C.line}; }
.v2-feed.is-active { background: #101016; }
.v2-footer { margin-top: 4rem; padding-top: 1.5rem; padding-bottom: 2.5rem; border-top: 1px solid ${C.line}; color: ${C.muted}; font-size: 0.8rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
@media (max-width: 720px) {
  .v2-hero { grid-template-columns: 1fr; gap: 1.75rem; margin-top: 2.5rem; }
  .v2-section { margin-top: 3.5rem; }
  .v2-section-first { margin-top: 2.5rem; padding-top: 2rem; }
  .v2-grid { grid-template-columns: repeat(2, 1fr); }
  .v2-feed { grid-template-columns: 1fr; gap: 0.25rem; }
  .v2-nav > span:last-child a:last-child { display: none; }
}
`;
