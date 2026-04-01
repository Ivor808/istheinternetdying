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

interface CVEChartProps {
  cveCounts: Array<{ date: string; count: number }>;
}

export function CVEChart({ cveCounts }: CVEChartProps) {
  if (cveCounts.length === 0) return null;

  const chartData = cveCounts.map((c) => ({
    date: c.date,
    cves: c.count,
  }));

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '0.25rem' }}>
        CVE Publications — Monthly
      </h2>
      <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '1rem', fontFamily: 'monospace' }}>
        vulnerabilities disclosed per month (source: NVD)
      </p>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#666"
            tick={{ fontSize: 11 }}
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
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontFamily: 'monospace' }}
            formatter={(value: number) => [`${value.toLocaleString()} CVEs`, 'Published']}
            labelFormatter={(date: string) => date}
          />
          <ReferenceLine
            x="2026-01-01"
            stroke="#ff4444"
            strokeDasharray="6 3"
            strokeOpacity={0.4}
          />
          <Bar
            dataKey="cves"
            fill="#f59e0b"
            fillOpacity={0.7}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
