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
  Label,
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

  const visibleEvents = dateRange
    ? AI_EVENTS.filter(
        (e) =>
          activeEventCategories.has(e.category) &&
          e.date >= dateRange.min &&
          e.date <= dateRange.max
      )
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
        Reliability Index — Jan 2024 to Present
      </h2>

      {/* Overlays toggle bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            categories
          </span>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              style={pillStyle(
                activeCategories.has(cat),
                CATEGORY_COLORS[cat] ?? '#666'
              )}
            >
              {cat}
            </button>
          ))}
          <span style={{ color: '#333', padding: '0 0.25rem' }}>|</span>
          <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            providers
          </span>
          {allProviders.map((slug) => (
            <button
              key={slug}
              onClick={() => toggleProvider(slug)}
              style={pillStyle(
                activeProviders.has(slug),
                PROVIDER_COLORS[slug] ?? '#666'
              )}
            >
              {providerNames[slug] ?? slug}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            marginTop: '0.5rem',
          }}
        >
          <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            ai events
          </span>
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleEventCategory(cat)}
              style={pillStyle(
                activeEventCategories.has(cat),
                EVENT_CATEGORY_COLORS[cat]
              )}
            >
              {EVENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} stroke="#666" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}
          />
          <ReferenceLine
            x="2026-01-01"
            stroke="#ff4444"
            strokeDasharray="6 3"
            strokeOpacity={0.6}
          >
            <Label
              value="AI Era"
              position="insideTopRight"
              fill="#ff4444"
              fontSize={11}
              opacity={0.8}
              offset={8}
            />
          </ReferenceLine>
          {visibleEvents.map((event, i) => (
            <ReferenceLine
              key={`${event.date}-${i}`}
              x={event.date}
              stroke={EVENT_CATEGORY_COLORS[event.category]}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            >
              <Label
                value={event.label}
                position="insideTop"
                fill={EVENT_CATEGORY_COLORS[event.category]}
                fontSize={9}
                opacity={0.7}
                angle={-90}
                offset={15}
              />
            </ReferenceLine>
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
