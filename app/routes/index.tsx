import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getDashboardData } from '@/data/dashboard';
import { DoomsdayClock } from '../components/DoomsdayClock';
import { TrendChart } from '../components/TrendChart';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { IndexHistory } from '../components/IndexHistory';

const loadDashboard = createServerFn().handler(async () => {
  return getDashboardData();
});

export const Route = createFileRoute('/')({
  loader: async () => loadDashboard(),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();

  return (
    <div className="dashboard">
      <header style={{ textAlign: 'center', padding: '2rem 1rem 0' }}>
        <h1
          style={{
            fontSize: '2.5rem',
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
            fontSize: '1.1rem',
            color: '#888',
            marginTop: '0.5rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}
        >
          the <span style={{ color: '#ff4444' }}>death</span> index
        </p>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#555',
            marginTop: '0.25rem',
            fontStyle: 'italic',
          }}
        >
          tracking the slow heat death of the internet, one status page at a time
        </p>
      </header>
      <DoomsdayClock
        globalScore={data.current?.globalScore ?? 100}
        previousScore={data.previous?.globalScore ?? null}
      />
      <TrendChart
        history={data.history}
        providerHistory={data.providerHistory}
      />
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
          color: '#444',
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
      </footer>
    </div>
  );
}
