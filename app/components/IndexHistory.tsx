import { useState } from 'react';

interface IndexHistoryEntry {
  date: string;
  globalScore: number;
  categoryScores: Record<string, number>;
}

interface IndexHistoryProps {
  history: IndexHistoryEntry[];
}

const PAGE_SIZE = 20;

function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e';
  if (score >= 85) return '#eab308';
  if (score >= 70) return '#f97316';
  return '#ef4444';
}

function minutesToMidnight(score: number): string {
  const minutes = 12 * (score / 100);
  return minutes.toFixed(1);
}

export function IndexHistory({ history }: IndexHistoryProps) {
  const rows = [...history].reverse();
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '1rem' }}>
        Death Index History
      </h2>
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #222',
          borderRadius: '8px',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Index</th>
              <th style={thStyle}>Minutes to Midnight</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const globalIndex = page * PAGE_SIZE + i;
              const prev = rows[globalIndex + 1];
              const delta = prev ? row.globalScore - prev.globalScore : null;

              return (
                <tr
                  key={row.date}
                  style={{
                    borderBottom: '1px solid #1a1a1a',
                    background: i % 2 === 0 ? '#0d0d12' : 'transparent',
                  }}
                >
                  <td style={tdStyle}>{row.date}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color: scoreColor(row.globalScore),
                      fontWeight: 'bold',
                    }}
                  >
                    {row.globalScore}
                  </td>
                  <td style={tdStyle}>
                    {minutesToMidnight(row.globalScore)}
                  </td>
                  <td style={tdStyle}>
                    {delta !== null && delta !== 0 && (
                      <span
                        style={{
                          color: delta > 0 ? '#4a4' : '#f44',
                        }}
                      >
                        {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                      </span>
                    )}
                    {delta === 0 && (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginTop: '1rem',
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={btnStyle(page === 0)}
          >
            Newer
          </button>
          <span style={{ color: '#666', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={btnStyle(page === totalPages - 1)}
          >
            Older
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'right',
  color: '#888',
  fontWeight: 'normal',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  textAlign: 'right',
  color: '#ccc',
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    border: '1px solid #333',
    background: disabled ? 'transparent' : '#1a1a1a',
    color: disabled ? '#444' : '#ccc',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
  };
}
