import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getDashboardData } from '@/data/dashboard';
import { DoomsdayClock } from '../components/DoomsdayClock';
import { TrendChart } from '../components/TrendChart';
import { CategoryBreakdown } from '../components/CategoryBreakdown';

const loadDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  return getDashboardData();
});

export const Route = createFileRoute('/')({
  loader: () => loadDashboard(),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();

  return (
    <div className="dashboard">
      <DoomsdayClock
        globalScore={data.current?.globalScore ?? 100}
        previousScore={data.previous?.globalScore ?? null}
      />
      <TrendChart
        history={data.history}
        providerHistory={data.providerHistory}
      />
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
