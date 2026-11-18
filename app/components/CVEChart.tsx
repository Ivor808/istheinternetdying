import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  AI_ERA_DATE,
  formatMonth,
  hasDataAroundAiEra,
  monthsInRange,
  rangeTitle,
  type RangeBounds,
  type RangeKey,
} from '@/data/chart';

interface CVEChartProps {
  cveCounts: Array<{ date: string; count: number }>;
  range: RangeKey;
  bounds: RangeBounds | null;
}

export function CVEChart({ cveCounts, range, bounds }: CVEChartProps) {
  const visible = bounds ? monthsInRange(cveCounts, bounds) : cveCounts;
  if (visible.length === 0) return null;

  const showAiEra = hasDataAroundAiEra(visible.map((c) => c.date));
  const chartData = visible.map((c) => ({
    date: c.date,
    cves: c.count,
  }));

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '0.25rem' }}>
        CVE Publications — {rangeTitle(range, bounds)}
      </h2>
      <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem', fontFamily: 'monospace' }}>
        vulnerabilities disclosed per month (source: NVD)
      </p>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#666"
            tick={{ fontSize: 11, fill: '#999' }}
            tickFormatter={(date: string) => {
              const [y, m] = date.split('-');
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return `${months[Number(m) - 1]} '${y.slice(2)}`;
            }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            stroke="#666"
            tick={{ fontSize: 11, fill: '#999' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontFamily: 'monospace' }}
            cursor={{ fill: '#ffffff0d' }}
            formatter={(value) => [`${Number(value).toLocaleString()} CVEs`, 'Published']}
            labelFormatter={(label) => formatMonth(String(label))}
          />
          {showAiEra && (
            <ReferenceLine
              x={AI_ERA_DATE}
              stroke="#ff4444"
              strokeDasharray="6 3"
              strokeOpacity={0.4}
            />
          )}
          <Bar
            dataKey="cves"
            fill="#f59e0b"
            fillOpacity={0.7}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
