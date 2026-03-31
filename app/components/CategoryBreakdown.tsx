interface CategoryBreakdownProps {
  categoryScores: Record<string, number>;
  previousCategoryScores: Record<string, number> | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  'cloud-infra': 'Cloud Infrastructure',
  ai: 'AI Services',
  'dev-tools': 'Developer Tools',
  productivity: 'Productivity',
  comms: 'Communications',
  fintech: 'Fintech',
};

function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e';
  if (score >= 85) return '#eab308';
  if (score >= 70) return '#f97316';
  return '#ef4444';
}

export function CategoryBreakdown({
  categoryScores,
  previousCategoryScores,
}: CategoryBreakdownProps) {
  const categories = Object.entries(categoryScores).sort(
    ([, a], [, b]) => a - b
  );

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '1rem' }}>
        Category Breakdown
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        {categories.map(([category, score]) => {
          const prevScore = previousCategoryScores?.[category] ?? null;
          const delta = prevScore !== null ? score - prevScore : null;

          return (
            <div
              key={category}
              style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {CATEGORY_LABELS[category] ?? category}
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: scoreColor(score),
                  marginTop: '0.25rem',
                  fontFamily: 'monospace',
                }}
              >
                {score}
              </div>
              {delta !== null && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: delta >= 0 ? '#4a4' : '#f44',
                    marginTop: '0.25rem',
                  }}
                >
                  {delta >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(delta)} from last week
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
