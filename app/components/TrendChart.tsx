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
  stripe: '#635bff',
  discord: '#5865f2',
};

export function TrendChart({ history, providerHistory }: TrendChartProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set()
  );
  const [activeProviders, setActiveProviders] = useState<Set<string>>(
    new Set()
  );

  const allCategories = Array.from(
    new Set(history.flatMap((h) => Object.keys(h.categoryScores)))
  );
  const allProviders = Array.from(
    new Set(providerHistory.map((p) => p.slug))
  );
  const providerNames = Object.fromEntries(
    providerHistory.map((p) => [p.slug, p.name])
  );

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

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '1rem' }}>
        Reliability Index — Jan 2024 to Present
      </h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              border: `1px solid ${CATEGORY_COLORS[cat] ?? '#666'}`,
              background: activeCategories.has(cat)
                ? CATEGORY_COLORS[cat] ?? '#666'
                : 'transparent',
              color: activeCategories.has(cat) ? '#fff' : CATEGORY_COLORS[cat] ?? '#666',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {cat}
          </button>
        ))}
        <span style={{ color: '#555', padding: '0.25rem 0' }}>|</span>
        {allProviders.map((slug) => (
          <button
            key={slug}
            onClick={() => toggleProvider(slug)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              border: `1px solid ${PROVIDER_COLORS[slug] ?? '#666'}`,
              background: activeProviders.has(slug)
                ? PROVIDER_COLORS[slug] ?? '#666'
                : 'transparent',
              color: activeProviders.has(slug) ? '#fff' : PROVIDER_COLORS[slug] ?? '#666',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {providerNames[slug] ?? slug}
          </button>
        ))}
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
