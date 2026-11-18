import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getDashboardData, getProviderHistory } from '@/data/dashboard';
import { DEFAULT_RANGE, formatDate, getRangeBounds, type RangeKey } from '@/data/chart';
import { EVENTS } from '@/data/events';
import { SITE_URL } from '@/data/site';
import { providerConfigs } from '@/providers/config';
import { DoomsdayClock } from '../components/DoomsdayClock';
import { TrendChart } from '../components/TrendChart';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { IndexHistory } from '../components/IndexHistory';
import { CVEChart } from '../components/CVEChart';

const loadDashboard = createServerFn().handler(async () => {
  return getDashboardData();
});

const loadProviderHistory = createServerFn().handler(async () => {
  return getProviderHistory();
});

const fetchProviderHistory = () => loadProviderHistory();

const DAY_MS = 24 * 60 * 60 * 1000;

// temporalCoverage starts at the first published (adequately covered) day
function datasetLd(firstDate: string | undefined) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'The Death Index',
    description: `A daily composite reliability score (0–100) for ${providerConfigs.length} major internet services, computed from public status page incident data.`,
    url: `${SITE_URL}/`,
    isAccessibleForFree: true,
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    ...(firstDate ? { temporalCoverage: `${firstDate}/..` } : {}),
    creator: { '@type': 'Person', name: 'Ivor808', url: 'https://github.com/Ivor808' },
    measurementTechnique: `${SITE_URL}/methodology`,
  };
}

export const Route = createFileRoute('/')({
  loader: async () => loadDashboard(),
  head: ({ loaderData }) => ({
    meta: [
      { property: 'og:url', content: `${SITE_URL}/` },
      // Live card; the date busts link-preview caches once a day
      ...[`${SITE_URL}/card/today.png?v=${loaderData?.history[loaderData.history.length - 1]?.date ?? ''}`].flatMap((image) => [
        { property: 'og:image', content: image },
        { name: 'twitter:image', content: image },
        { property: 'og:image:alt', content: "Today's Death Index and the services having issues right now" },
      ]),
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/` }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(datasetLd(loaderData?.history[0]?.date)),
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();
  const history = data.history;
  const [selectedIdx, setSelectedIdx] = useState(history.length - 1);
  const selected = history[selectedIdx];
  // The clock compares against the same day a week earlier, if we have it
  const weekBefore = useMemo(() => {
    if (!selected) return null;
    const target = new Date(Date.parse(`${selected.date}T00:00:00Z`) - 7 * DAY_MS)
      .toISOString()
      .slice(0, 10);
    return history.find((h) => h.date === target) ?? null;
  }, [history, selected]);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const bounds = useMemo(
    () => getRangeBounds(history.map((h) => h.date), range),
    [history, range]
  );
  const latestDate = history[history.length - 1]?.date;
  const latestOutage = useMemo(
    () =>
      EVENTS.filter((e) => e.category === 'outage' && (!latestDate || e.date <= latestDate)).sort(
        (a, b) => (a.date < b.date ? 1 : -1)
      )[0],
    [latestDate]
  );

  return (
    <div className="dashboard">
      <a
        href="https://github.com/Ivor808/istheinternetdying"
        target="_blank"
        rel="noopener noreferrer"
        title="View on GitHub"
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          color: '#888',
          zIndex: 20,
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#e0e0e0')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
      >
        <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
      <header style={{ textAlign: 'center', padding: '2rem 1rem 0' }}>
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 8vw, 2.5rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: '#e0e0e0',
            fontFamily: 'monospace',
          }}
        >
          is the internet dying<span style={{ color: '#ff4444' }}>?</span>
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#888',
            marginTop: '0.25rem',
            fontStyle: 'italic',
          }}
        >
          tracking the slow heat death of the internet, one status page at a time
        </p>
      </header>
      <DoomsdayClock
        globalScore={selected?.globalScore ?? 100}
        previousScore={weekBefore?.globalScore ?? null}
      />
      {latestOutage && (
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: '#888',
            margin: '-0.75rem 1rem 1.25rem',
          }}
        >
          latest major outage:{' '}
          <span style={{ color: '#ef4444' }}>{latestOutage.label}</span> ·{' '}
          {formatDate(latestOutage.date)}
        </p>
      )}
      {history.length > 1 && (
        <div
          style={{
            maxWidth: '500px',
            margin: '0 auto',
            padding: '0 1rem',
            textAlign: 'center',
          }}
        >
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#ff4444',
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: '#888',
              marginTop: '0.25rem',
            }}
          >
            <span>{history[0]?.date}</span>
            <span style={{ color: '#ccc' }}>
              {selected?.date ?? '—'}
              {selectedIdx === history.length - 1 && (
                <span style={{ color: '#ff4444' }}> (latest)</span>
              )}
            </span>
            <span>{history[history.length - 1]?.date}</span>
          </div>
        </div>
      )}
      <div
        style={{
          maxWidth: '500px',
          margin: '1.5rem auto 0',
          padding: '0 1rem',
          textAlign: 'center',
        }}
      >
        <details
          style={{
            color: '#777',
            fontSize: '0.9rem',
            lineHeight: 1.7,
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              color: '#888',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              listStyle: 'none',
            }}
          >
            what is the death index? ▾
          </summary>
          <p style={{ marginTop: '0.75rem' }}>
            The Death Index is a single number (0–100) representing the overall
            reliability of the internet's most critical services. We aggregate
            public incident data from {providerConfigs.length} major providers across cloud
            infrastructure, developer tools, productivity apps, and more — then
            compute a composite score. The closer to midnight, the worse things
            are.{' '}
            <a href="/methodology" style={{ color: '#ff4444', textDecoration: 'none' }}>
              How it works →
            </a>
          </p>
        </details>
      </div>
      <TrendChart
        history={data.history}
        providers={data.providers}
        loadProviderHistory={fetchProviderHistory}
        range={range}
        bounds={bounds}
        onRangeChange={setRange}
      />
      <CVEChart cveCounts={data.cveCounts} range={range} bounds={bounds} />
      <IndexHistory history={data.history} />
      {data.current && (
        <CategoryBreakdown
          categoryScores={data.current.categoryScores}
          previousCategoryScores={
            data.previous
              ? data.history.find((h) => h.date === data.previous!.date)
                  ?.categoryScores ?? null
              : null
          }
        />
      )}
      <footer
        style={{
          borderTop: '1px solid #1a1a1a',
          marginTop: '3rem',
          padding: '2rem 1rem',
          textAlign: 'center',
          color: '#888',
          fontSize: '0.75rem',
          lineHeight: 1.6,
        }}
      >
        <p>
          istheinternetdying.com is an independent project. The Death Index is computed
          from publicly available status page data and represents an analytical
          interpretation — not an endorsement of or affiliation with any listed provider.
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          Not financial, operational, or professional advice. Just vibes and math.
        </p>
        <p style={{ marginTop: '0.75rem' }}>
          <a
            href="https://github.com/Ivor808/istheinternetdying"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#bbb', textDecoration: 'none' }}
          >
            open source — contribute on github
          </a>
          {' · '}
          <a
            href="/methodology"
            style={{ color: '#bbb', textDecoration: 'none' }}
          >
            methodology
          </a>
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <a
            href="https://ko-fi.com/ivorz"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#bbb', textDecoration: 'none' }}
          >
            <span style={{ color: '#ff4444' }}>{'\u2764'}</span> support this project
          </a>
        </p>
      </footer>
    </div>
  );
}
