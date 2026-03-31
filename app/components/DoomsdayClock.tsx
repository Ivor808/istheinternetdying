interface DoomsdayClockProps {
  globalScore: number;
  previousScore: number | null;
}

export function DoomsdayClock({ globalScore, previousScore }: DoomsdayClockProps) {
  const minutesToMidnight = 12 * (globalScore / 100);
  const displayMinutes = Math.round(minutesToMidnight * 10) / 10;

  // Clock hand angle: noon (score=100) = 180deg, midnight (score=0) = 360deg/0deg
  const handAngle = 180 + (1 - globalScore / 100) * 180;

  // Color: green at noon, red at midnight
  const urgency = 1 - globalScore / 100;
  const r = Math.round(urgency * 255);
  const g = Math.round((1 - urgency) * 180);
  const handColor = `rgb(${r}, ${g}, 50)`;

  const delta = previousScore !== null ? globalScore - previousScore : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1rem',
      }}
    >
      <svg viewBox="0 0 200 200" width="300" height="300">
        <circle cx="100" cy="100" r="95" fill="none" stroke="#333" strokeWidth="2" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#222" strokeWidth="1" />

        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 100 + 80 * Math.sin(angle);
          const y1 = 100 - 80 * Math.cos(angle);
          const x2 = 100 + 88 * Math.sin(angle);
          const y2 = 100 - 88 * Math.cos(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#555"
              strokeWidth={i === 0 ? 3 : 1.5}
            />
          );
        })}

        <text x="100" y="30" textAnchor="middle" fill="#ff4444" fontSize="9" fontWeight="bold">
          MIDNIGHT
        </text>

        <line
          x1="100"
          y1="100"
          x2={100 + 70 * Math.sin((handAngle * Math.PI) / 180)}
          y2={100 - 70 * Math.cos((handAngle * Math.PI) / 180)}
          stroke={handColor}
          strokeWidth="3"
          strokeLinecap="round"
        />

        <circle cx="100" cy="100" r="4" fill={handColor} />

        <circle
          cx={100 + 70 * Math.sin((handAngle * Math.PI) / 180)}
          cy={100 - 70 * Math.cos((handAngle * Math.PI) / 180)}
          r="3"
          fill={handColor}
          opacity="0.6"
        />
      </svg>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <div
          style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: handColor,
            letterSpacing: '0.15em',
            fontFamily: 'monospace',
          }}
        >
          {displayMinutes} MINUTES TO MIDNIGHT
        </div>
        <div style={{ fontSize: '1rem', color: '#888', marginTop: '0.5rem' }}>
          Death Index: {globalScore}
        </div>
        {delta !== null && (
          <div
            style={{
              fontSize: '0.85rem',
              color: delta >= 0 ? '#4a4' : '#f44',
              marginTop: '0.25rem',
            }}
          >
            {delta >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(delta)} from last week
          </div>
        )}
      </div>
    </div>
  );
}
