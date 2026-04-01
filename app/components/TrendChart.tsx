import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import {
  AI_EVENTS,
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_LABELS,
  type AIEvent,
} from '@/data/ai-events';

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
  providerHistory: ProviderHistoryEntry[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'cloud-infra': '#3b82f6',
  ai: '#a855f7',
  'dev-tools': '#22c55e',
  productivity: '#eab308',
  comms: '#f97316',
  fintech: '#06b6d4',
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

const EVENT_CATEGORIES: AIEvent['category'][] = ['model', 'tool', 'industry'];

export function TrendChart({ history, providerHistory }: TrendChartProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set()
  );
  const [activeProviders, setActiveProviders] = useState<Set<string>>(
    new Set()
  );
  const [activeEventCategories, setActiveEventCategories] = useState<
    Set<AIEvent['category']>
  >(new Set());
  const [hoveredEvent, setHoveredEvent] = useState<AIEvent | null>(null);

  const allCategories = Array.from(
    new Set(history.flatMap((h) => Object.keys(h.categoryScores)))
  );
  const allProviders = Array.from(
    new Set(providerHistory.map((p) => p.slug))
  );
  const providerNames = Object.fromEntries(
    providerHistory.map((p) => [p.slug, p.name])
  );

  // Only show events that fall within our data range
  const dateRange = history.length > 0
    ? { min: history[0].date, max: history[history.length - 1].date }
    : null;

  // Snap events to nearest data point so Recharts can render them
  const dataPointDates = new Set(history.map((h) => h.date));
  const snapToNearest = (eventDate: string): string | null => {
    if (dataPointDates.has(eventDate)) return eventDate;
    const eventTime = new Date(eventDate).getTime();
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const d of dataPointDates) {
      const dist = Math.abs(new Date(d).getTime() - eventTime);
      if (dist < closestDist) {
        closestDist = dist;
        closest = d;
      }
    }
    return closest;
  };

  const visibleEvents = dateRange
    ? AI_EVENTS
        .filter(
          (e) =>
            activeEventCategories.has(e.category) &&
            e.date >= dateRange.min &&
            e.date <= dateRange.max
        )
        .map((e) => ({ ...e, snappedDate: snapToNearest(e.date) }))
        .filter((e): e is typeof e & { snappedDate: string } => e.snappedDate !== null)
    : [];

  const chartData = history.map((h) => {
    const entry: Record<string, number | string | undefined> = {
      date: h.date,
      global: h.globalScore,
    };

    for (const cat of activeCategories) {
      entry[cat] = h.categoryScores[cat] ?? undefined;
    }

    for (const slug of activeProviders) {
      const provEntry = providerHistory.find(
        (p) => p.date === h.date && p.slug === slug
      );
      entry[slug] = provEntry?.score ?? undefined;
    }

    return entry;
  });

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleProvider = (slug: string) => {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleEventCategory = (cat: AIEvent['category']) => {
    setActiveEventCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '1rem' }}>
        Death Index — Jan 2024 to Present
      </h2>

      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis
              dataKey="date"
              stroke="#666"
              tick={{ fontSize: 11 }}
              tickFormatter={(date: string) => {
                const [y, m] = date.split('-');
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${months[Number(m) - 1]} '${y.slice(2)}`;
              }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis domain={[50, 100]} stroke="#666" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}
            />
            {/* AI Era line — always shown */}
            <ReferenceLine

              x="2026-01-01"
              stroke="#ff4444"
              strokeDasharray="6 3"
              strokeOpacity={0.4}
            />
            <ReferenceDot

              x="2026-01-01"
              y={98}
              r={0}
              label={{ value: '▼ AI Era', fill: '#ff4444', fontSize: 10, position: 'insideBottom' }}
            />
            {/* Event marker lines */}
            {visibleEvents.map((event, i) => {
              const isHovered = hoveredEvent?.date === event.date && hoveredEvent?.label === event.label;
              return (
                <ReferenceLine
    
                  key={`line-${event.snappedDate}-${i}`}
                  x={event.snappedDate}
                  stroke={EVENT_CATEGORY_COLORS[event.category]}
                  strokeDasharray="2 4"
                  strokeOpacity={isHovered ? 0.8 : 0.3}
                  strokeWidth={isHovered ? 2 : 1}
                />
              );
            })}
            {/* Event dot markers at top of chart */}
            {visibleEvents.map((event, i) => (
              <ReferenceDot
  
                key={`dot-${event.snappedDate}-${i}`}
                x={event.snappedDate}
                y={97}
                r={4}
                fill={EVENT_CATEGORY_COLORS[event.category]}
                fillOpacity={hoveredEvent?.date === event.date && hoveredEvent?.label === event.label ? 1 : 0.6}
                stroke="none"
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
                style={{ cursor: 'pointer' }}
              />
            ))}
            <Line

              type="monotone"
              dataKey="global"
              stroke="#e0e0e0"
              strokeWidth={2}
              dot={false}
              name="Global Index"
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
                name={cat}
                connectNulls={false}
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
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Hover tooltip for event markers */}
        {hoveredEvent && (
          <div
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '1rem',
              background: '#1a1a1a',
              border: `1px solid ${EVENT_CATEGORY_COLORS[hoveredEvent.category]}`,
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ color: EVENT_CATEGORY_COLORS[hoveredEvent.category], fontWeight: 'bold' }}>
              {hoveredEvent.label}
            </div>
            <div style={{ color: '#888', marginTop: '0.15rem' }}>
              {hoveredEvent.date} · {EVENT_CATEGORY_LABELS[hoveredEvent.category]}
            </div>
          </div>
        )}
      </div>

      {/* Controls below chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        <ControlRow label="categories">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              style={pillStyle(activeCategories.has(cat), CATEGORY_COLORS[cat] ?? '#666')}
            >
              {cat}
            </button>
          ))}
        </ControlRow>
        <ControlRow label="providers">
          {allProviders.map((slug) => (
            <button
              key={slug}
              onClick={() => toggleProvider(slug)}
              style={pillStyle(activeProviders.has(slug), PROVIDER_COLORS[slug] ?? '#666')}
            >
              {providerNames[slug] ?? slug}
            </button>
          ))}
        </ControlRow>
        <ControlRow label="ai events">
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleEventCategory(cat)}
              style={pillStyle(activeEventCategories.has(cat), EVENT_CATEGORY_COLORS[cat])}
            >
              {EVENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </ControlRow>
      </div>
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <span
        style={{
          color: '#555',
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

function pillStyle(active: boolean, color: string): React.CSSProperties {
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
