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
            fontSize: '3rem',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: '#e0e0e0',
            fontFamily: 'monospace',
          }}
        >
          doomsd<span style={{ color: '#ff4444' }}>.</span>ai
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: '#666',
            marginTop: '0.25rem',
            fontStyle: 'italic',
          }}
        >
          monitoring the slow heat death of the internet, one status page at a time
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
    </div>
  );
}
