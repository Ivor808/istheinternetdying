import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  usePlotArea,
  useXAxisScale,
  type TooltipContentProps,
} from 'recharts';
import {
  EVENTS,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_LABELS,
  eventId,
  type EventCategory,
  type TimelineEvent,
} from '@/data/events';
import {
  AI_ERA_DATE,
  RANGE_PRESETS,
  SMOOTHING_DAYS,
  WIDE_RANGE_DAYS,
  formatDate,
  formatMonth,
  formatTick,
  hasDataAroundAiEra,
  layoutEventLabels,
  rangeTitle,
  rollingMean,
  sliceToRange,
  timeTicks,
  toTs,
  yAxisScale,
  type RangeBounds,
  type RangeKey,
} from '@/data/chart';
import { EventTimeline } from './EventTimeline';

interface HistoryEntry {
  date: string;
  globalScore: number;
  categoryScores: Record<string, number>;
}

interface ProviderHistoryEntry {
  date: string;
  slug: string;
  name: string;
  score: number;
}

interface TrendChartProps {
  history: HistoryEntry[];
  providers: Array<{ slug: string; name: string }>;
  loadProviderHistory: () => Promise<ProviderHistoryEntry[]>;
  range: RangeKey;
  bounds: RangeBounds | null;
  onRangeChange: (range: RangeKey) => void;
}

interface ChartRow {
  ts: number;
  date: string;
  monthly: boolean;
  [series: string]: number | string | boolean | undefined;
}

export const CATEGORY_COLORS: Record<string, string> = {
  'cloud-infra': '#3b82f6',
  ai: '#a855f7',
  'dev-tools': '#22c55e',
  productivity: '#eab308',
  comms: '#f97316',
  fintech: '#06b6d4',
};

export const CATEGORY_NAMES: Record<string, string> = {
  'cloud-infra': 'Cloud Infra',
  ai: 'AI',
  'dev-tools': 'Dev Tools',
  productivity: 'Productivity',
  comms: 'Comms',
  fintech: 'Fintech',
};

const PROVIDER_COLORS: Record<string, string> = {
  cloudflare: '#f48120',
  github: '#8b5cf6',
  openai: '#10a37f',
  anthropic: '#d4a574',
  discord: '#5865f2',
  npm: '#cb3837',
  dropbox: '#0061ff',
  reddit: '#ff4500',
};

const LABEL_ROWS = 2;
const LABEL_ROW_HEIGHT = 13;
const CHART_TOP_MARGIN = LABEL_ROWS * LABEL_ROW_HEIGHT + 16;

export function TrendChart({
  history,
  providers,
  loadProviderHistory,
  range,
  bounds,
  onRangeChange,
}: TrendChartProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set());
  const [activeEventCategories, setActiveEventCategories] = useState<Set<EventCategory>>(
    () => new Set(EVENT_CATEGORIES)
  );
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(false);
  const [providerHistory, setProviderHistory] = useState<ProviderHistoryEntry[] | null>(null);
  const [providerError, setProviderError] = useState(false);

  // Provider scores aren't in the page payload; fetch them the first time one is switched on
  const needProviders = activeProviders.size > 0 && providerHistory === null && !providerError;
  useEffect(() => {
    if (!needProviders) return;
    let cancelled = false;
    loadProviderHistory()
      .then((rows) => !cancelled && setProviderHistory(rows))
      .catch(() => !cancelled && setProviderError(true));
    return () => {
      cancelled = true;
    };
  }, [needProviders, loadProviderHistory]);

  const allCategories = useMemo(
    () => Array.from(new Set(history.flatMap((h) => Object.keys(h.categoryScores)))),
    [history]
  );

  const providerNames = useMemo(
    () => Object.fromEntries(providers.map((p) => [p.slug, p.name])),
    [providers]
  );

  const providerScores = useMemo(() => {
    const scores = new Map<string, Map<string, number>>();
    for (const p of providerHistory ?? []) {
      let bySlug = scores.get(p.slug);
      if (!bySlug) {
        bySlug = new Map();
        scores.set(p.slug, bySlug);
      }
      bySlug.set(p.date, p.score);
    }
    return scores;
  }, [providerHistory]);

  const visibleHistory = useMemo(
    () => (bounds ? sliceToRange(history, bounds) : []),
    [history, bounds]
  );

  const startTs = bounds ? toTs(bounds.start) : 0;
  const endTs = bounds ? toTs(bounds.end) : 0;
  const spanDays = (endTs - startTs) / 86400000;
  const wideRange = spanDays > WIDE_RANGE_DAYS;

  // Series are computed over the full history so smoothing has no edge effect at the range start
  const chartData = useMemo<ChartRow[]>(() => {
    const dates = history.map((h) => h.date);
    const indexByDate = new Map(dates.map((d, i) => [d, i]));
    const series = new Map<string, Array<number | undefined>>();
    const addSeries = (key: string, raw: Array<number | undefined>) =>
      series.set(key, wideRange ? rollingMean(dates, raw, SMOOTHING_DAYS) : raw);

    addSeries('global', history.map((h) => h.globalScore));
    for (const cat of activeCategories) addSeries(cat, history.map((h) => h.categoryScores[cat]));
    for (const slug of activeProviders) {
      const bySlug = providerScores.get(slug);
      if (bySlug) addSeries(slug, history.map((h) => bySlug.get(h.date)));
    }

    return visibleHistory.map((h, i) => {
      const next = visibleHistory[i + 1];
      const idx = indexByDate.get(h.date)!;
      const row: ChartRow = {
        ts: toTs(h.date),
        date: h.date,
        monthly: next ? toTs(next.date) - toTs(h.date) > 2 * 86400000 : false,
      };
      for (const [key, values] of series) row[key] = values[idx];
      return row;
    });
  }, [history, visibleHistory, activeCategories, activeProviders, providerScores, wideRange]);

  const visibleEvents = useMemo(
    () =>
      bounds
        ? EVENTS.filter(
            (e) =>
              activeEventCategories.has(e.category) &&
              e.date >= bounds.start &&
              e.date <= bounds.end
          ).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        : [],
    [bounds, activeEventCategories]
  );

  // Events attributed to each data point: same day, or the whole month for monthly points
  const eventsByDate = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    chartData.forEach((row, i) => {
      const nextDate = chartData[i + 1]?.date;
      const matches = visibleEvents.filter((e) =>
        row.monthly && nextDate ? e.date >= row.date && e.date < nextDate : e.date === row.date
      );
      if (matches.length > 0) map.set(row.date, matches);
    });
    return map;
  }, [chartData, visibleEvents]);

  const yScale = useMemo(() => {
    const keys = ['global', ...activeCategories, ...activeProviders];
    const values = chartData.flatMap((row) =>
      keys.map((k) => row[k]).filter((v): v is number => typeof v === 'number')
    );
    return yAxisScale(values);
  }, [chartData, activeCategories, activeProviders]);

  const xTicks = useMemo(() => timeTicks(startTs, endTs), [startTs, endTs]);
  const aiEraTs = toTs(AI_ERA_DATE);
  // Only with covered index data on both sides of the line
  const showAiEra =
    aiEraTs > startTs && aiEraTs <= endTs && hasDataAroundAiEra(history.map((h) => h.date));

  const summary = useMemo(() => {
    const rows = chartData.filter(
      (r) => typeof r.global === 'number' && (!bounds || r.date >= bounds.start)
    );
    if (rows.length === 0) return 'No data for this range.';
    const low = rows.reduce((a, b) => ((b.global as number) < (a.global as number) ? b : a));
    const fmt = (v: unknown) => Math.round(v as number);
    return (
      `Death Index, ${rangeTitle(range, bounds).toLowerCase()}: ` +
      `${fmt(rows[0].global)} on ${formatDate(rows[0].date)}, ` +
      `${fmt(rows[rows.length - 1].global)} on ${formatDate(rows[rows.length - 1].date)}, ` +
      `lowest ${fmt(low.global)} on ${formatDate(low.date)}.`
    );
  }, [chartData, range, bounds]);

  const activeEventId = selectedEventId ?? hoveredEventId;
  const activeEvent = visibleEvents.find((e) => eventId(e) === activeEventId) ?? null;

  const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const selectEvent = (id: string) => setSelectedEventId((prev) => (prev === id ? null : id));

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ color: '#ccc' }}>Death Index — {rangeTitle(range, bounds)}</h2>
          {bounds && (
            <div style={{ color: '#888', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.25rem' }}>
              {formatDate(bounds.start)} – {formatDate(bounds.end)}
              {wideRange && ` · ${SMOOTHING_DAYS}-day average`}
            </div>
          )}
        </div>
        <div role="group" aria-label="Time range" style={{ display: 'flex', gap: '0.25rem' }}>
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => onRangeChange(p.key)}
              aria-pressed={range === p.key}
              style={pillStyle(range === p.key, '#ff4444')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div role="figure" aria-label={summary} style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: CHART_TOP_MARGIN, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={[startTs, endTs]}
              allowDataOverflow
              ticks={xTicks}
              stroke="#666"
              tick={{ fontSize: 11, fill: '#999' }}
              tickFormatter={(ts: number) => formatTick(ts, spanDays)}
              minTickGap={40}
            />
            <YAxis
              domain={yScale.domain}
              ticks={yScale.ticks}
              allowDataOverflow
              stroke="#666"
              tick={{ fontSize: 12, fill: '#999' }}
              width={40}
            />
            <Tooltip
              content={(props) => <ChartTooltip {...props} eventsByDate={eventsByDate} smoothed={wideRange} />}
              cursor={{ stroke: '#444' }}
            />
            {showAiEra && (
              <ReferenceLine
                x={aiEraTs}
                stroke="#ff4444"
                strokeDasharray="6 3"
                strokeOpacity={0.4}
                label={{ value: 'AI Era ▸', fill: '#ff4444', fontSize: 10, position: 'insideBottomLeft' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="global"
              stroke="#e0e0e0"
              strokeWidth={2}
              dot={false}
              name="Global Index"
              isAnimationActive={false}
            />
            {Array.from(activeCategories).map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat] ?? '#666'}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                name={CATEGORY_NAMES[cat] ?? cat}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {Array.from(activeProviders).map((slug) => (
              <Line
                key={slug}
                type="monotone"
                dataKey={slug}
                stroke={PROVIDER_COLORS[slug] ?? '#666'}
                strokeWidth={1.5}
                dot={false}
                name={providerNames[slug] ?? slug}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            <EventLayer
              events={
                wideRange
                  ? visibleEvents.filter(
                      (e) => e.major || e.category === 'outage' || eventId(e) === activeEventId
                    )
                  : visibleEvents
              }
              activeId={activeEventId}
              onHover={setHoveredEventId}
              onSelect={selectEvent}
            />
          </LineChart>
        </ResponsiveContainer>

        {activeEvent && (
          <div
            style={{
              position: 'absolute',
              top: `${CHART_TOP_MARGIN + 8}px`,
              right: '1.25rem',
              maxWidth: 'min(280px, 70%)',
              background: '#1a1a1a',
              border: `1px solid ${EVENT_CATEGORY_COLORS[activeEvent.category]}`,
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              pointerEvents: selectedEventId ? 'auto' : 'none',
              zIndex: 10,
            }}
          >
            {selectedEventId && (
              <button
                onClick={() => setSelectedEventId(null)}
                aria-label="Close"
                style={{
                  float: 'right',
                  marginLeft: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
            <div style={{ color: EVENT_CATEGORY_COLORS[activeEvent.category], fontWeight: 'bold' }}>
              {activeEvent.label}
            </div>
            <div style={{ color: '#888', marginTop: '0.15rem' }}>
              {formatDate(activeEvent.date)} · {EVENT_CATEGORY_LABELS[activeEvent.category]}
            </div>
            {activeEvent.description && (
              <div style={{ color: '#bbb', marginTop: '0.35rem', lineHeight: 1.4 }}>
                {activeEvent.description}
              </div>
            )}
            {activeEvent.url && selectedEventId && (
              <a
                href={activeEvent.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', color: '#888', marginTop: '0.35rem' }}
              >
                source ↗
              </a>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        <ControlRow label="categories">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(setActiveCategories, cat)}
              aria-pressed={activeCategories.has(cat)}
              style={pillStyle(activeCategories.has(cat), CATEGORY_COLORS[cat] ?? '#666')}
            >
              {CATEGORY_NAMES[cat] ?? cat}
            </button>
          ))}
        </ControlRow>
        <ControlRow label="providers">
          {showProviders || activeProviders.size > 0 ? (
            providers.map(({ slug, name }) => (
              <button
                key={slug}
                onClick={() => toggle(setActiveProviders, slug)}
                aria-pressed={activeProviders.has(slug)}
                style={pillStyle(activeProviders.has(slug), PROVIDER_COLORS[slug] ?? '#666')}
              >
                {name}
              </button>
            ))
          ) : (
            <button onClick={() => setShowProviders(true)} style={pillStyle(false, '#888')}>
              + {providers.length} providers
            </button>
          )}
          {activeProviders.size > 0 && providerHistory === null && (
            <span style={{ color: '#888', fontSize: '0.7rem', fontFamily: 'monospace' }}>
              {providerError ? "couldn't load provider data" : 'loading…'}
            </span>
          )}
        </ControlRow>
        <ControlRow label="events">
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(setActiveEventCategories, cat)}
              aria-pressed={activeEventCategories.has(cat)}
              style={pillStyle(activeEventCategories.has(cat), EVENT_CATEGORY_COLORS[cat])}
            >
              {EVENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </ControlRow>
      </div>

      <EventTimeline
        events={visibleEvents}
        activeId={activeEventId}
        selectedId={selectedEventId}
        onHover={setHoveredEventId}
        onSelect={selectEvent}
      />
    </div>
  );
}

export function EventLayer({
  events,
  activeId,
  onHover,
  onSelect,
}: {
  events: TimelineEvent[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const xScale = useXAxisScale();
  const plot = usePlotArea();
  if (!xScale || !plot) return null;

  const points = events.flatMap((e) => {
    const x = xScale(toTs(e.date));
    if (x === undefined || x < plot.x - 0.5 || x > plot.x + plot.width + 0.5) return [];
    return [{ e, id: eventId(e), x }];
  });

  // Outages outrank model launches; newer outranks older
  const labels = layoutEventLabels(
    points
      .filter((p) => p.e.major)
      .map((p) => ({
        id: p.id,
        x: p.x,
        text: p.e.label,
        priority: (p.e.category === 'outage' ? 1 : 0) + toTs(p.e.date) / 1e13,
      })),
    { rows: LABEL_ROWS, charWidth: 6.1, gap: 8, minX: plot.x, maxX: plot.x + plot.width }
  );

  const top = plot.y;
  const bottom = plot.y + plot.height;
  const placedLabels = Array.from(labels.values());
  const crossesLowerLabel = (x: number, row: number) =>
    placedLabels.some((l) => l.row < row && Math.abs(l.cx - x) <= l.width / 2 + 2);

  return (
    <g className="event-layer">
      {points.map(({ e, id, x }) => (
        <line
          key={`line-${id}`}
          x1={x}
          x2={x}
          y1={top}
          y2={bottom}
          stroke={EVENT_CATEGORY_COLORS[e.category]}
          strokeDasharray="2 4"
          strokeOpacity={id === activeId ? 0.9 : e.major ? 0.35 : 0.2}
          strokeWidth={id === activeId ? 2 : 1}
          pointerEvents="none"
        />
      ))}
      {points.map(({ e, id, x }) => {
        const placed = labels.get(id);
        if (!placed) return null;
        const baseline = top - 8 - placed.row * LABEL_ROW_HEIGHT;
        const color = EVENT_CATEGORY_COLORS[e.category];
        return (
          <g
            key={`label-${id}`}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect(id);
            }}
            style={{ cursor: 'pointer' }}
          >
            {placed.row > 0 && !crossesLowerLabel(x, placed.row) && (
              <line x1={x} x2={x} y1={baseline + 3} y2={top - 5} stroke={color} strokeOpacity={0.35} />
            )}
            <text
              x={placed.cx}
              y={baseline}
              textAnchor="middle"
              fontSize={10}
              fontFamily="monospace"
              fill={color}
              fillOpacity={id === activeId ? 1 : 0.85}
              fontWeight={id === activeId ? 'bold' : 'normal'}
            >
              {e.label}
            </text>
          </g>
        );
      })}
      {points.map(({ e, id, x }) => {
        const active = id === activeId;
        return (
          <g
            key={`dot-${id}`}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect(id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={x} cy={top} r={11} fill="transparent" />
            <circle
              cx={x}
              cy={top}
              r={active ? 6 : e.major ? 4.5 : 3.5}
              fill={EVENT_CATEGORY_COLORS[e.category]}
              fillOpacity={active ? 1 : e.major ? 0.9 : 0.6}
              stroke={active ? '#fff' : 'none'}
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  eventsByDate,
  smoothed,
}: TooltipContentProps & { eventsByDate: Map<string, TimelineEvent[]>; smoothed: boolean }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as ChartRow;
  const events = eventsByDate.get(row.date) ?? [];
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '6px',
        padding: '0.5rem 0.75rem',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        maxWidth: '260px',
      }}
    >
      <div style={{ color: '#ccc', marginBottom: '0.35rem' }}>
        {row.monthly
          ? `${formatMonth(row.date)} (monthly)`
          : `${formatDate(row.date)}${smoothed ? ` (${SMOOTHING_DAYS}-day avg)` : ''}`}
      </div>
      {payload.map((entry) =>
        typeof entry.value === 'number' ? (
          <div
            key={String(entry.dataKey)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#aaa', lineHeight: 1.6 }}
          >
            <span
              style={{ width: '8px', height: '8px', borderRadius: '2px', background: entry.color, flexShrink: 0 }}
            />
            <span style={{ flex: 1 }}>{entry.name}</span>
            <span style={{ color: '#e0e0e0', marginLeft: '0.75rem' }}>{entry.value.toFixed(1)}</span>
          </div>
        ) : null
      )}
      {events.length > 0 && (
        <div style={{ borderTop: '1px solid #333', marginTop: '0.35rem', paddingTop: '0.35rem' }}>
          {events.map((e) => (
            <div key={eventId(e)} style={{ color: EVENT_CATEGORY_COLORS[e.category], lineHeight: 1.5 }}>
              ● {e.label}
              {row.monthly && <span style={{ color: '#888' }}> · {formatDate(e.date)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <span
        style={{
          color: '#888',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          width: '5.5rem',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function pillStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '0.2rem 0.6rem',
    borderRadius: '9999px',
    border: `1px solid ${color}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : color,
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    transition: 'all 0.15s',
  };
}
