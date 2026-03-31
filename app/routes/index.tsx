import { useState } from 'react';
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
  const history = data.history;
  const [selectedIdx, setSelectedIdx] = useState(history.length - 1);
  const selected = history[selectedIdx];
  const prev = selectedIdx > 0 ? history[selectedIdx - 1] : null;

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
      <div
        style={{
          maxWidth: '600px',
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
            what is this? ▾
          </summary>
          <p style={{ marginTop: '0.75rem' }}>
            The Death Index is a single number (0–100) representing the overall
            reliability of the internet's most critical services. We aggregate
            public incident data from 51 major providers across cloud
            infrastructure, developer tools, productivity apps, and more — then
            compute a composite score. The closer to midnight, the worse things
            are.{' '}
            <a href="/methodology" style={{ color: '#ff4444', textDecoration: 'none' }}>
              How it works →
            </a>
          </p>
        </details>
      </div>
      <DoomsdayClock
        globalScore={selected?.globalScore ?? 100}
        previousScore={prev?.globalScore ?? null}
      />
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
              color: '#555',
              marginTop: '0.25rem',
            }}
          >
            <span>{history[0]?.date}</span>
            <span style={{ color: '#888' }}>
              {selected?.date ?? '—'}
              {selectedIdx === history.length - 1 && (
                <span style={{ color: '#ff4444' }}> (today)</span>
              )}
            </span>
            <span>{history[history.length - 1]?.date}</span>
          </div>
        </div>
      )}
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
