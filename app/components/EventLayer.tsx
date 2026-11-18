import { usePlotArea, useXAxisScale } from 'recharts';
import { EVENT_CATEGORY_COLORS, eventId, type TimelineEvent } from '@/data/events';
import { layoutEventLabels, toTs } from '@/data/chart';

// Event markers drawn inside a Recharts chart: a dashed line per event, a dot on the top edge,
// and labels for major events stacked in up to LABEL_ROWS rows above the plot

const LABEL_ROWS = 2;
const LABEL_ROW_HEIGHT = 13;

export function EventLayer({
  events,
  activeId,
  onHover,
  onSelect,
}: {
  events: TimelineEvent[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const xScale = useXAxisScale();
  const plot = usePlotArea();
  if (!xScale || !plot) return null;

  const points = events.flatMap((e) => {
    const x = xScale(toTs(e.date));
    if (x === undefined || x < plot.x - 0.5 || x > plot.x + plot.width + 0.5) return [];
    return [{ e, id: eventId(e), x }];
  });

  // Outages outrank model launches; newer outranks older
  const labels = layoutEventLabels(
    points
      .filter((p) => p.e.major)
      .map((p) => ({
        id: p.id,
        x: p.x,
        text: p.e.label,
        priority: (p.e.category === 'outage' ? 1 : 0) + toTs(p.e.date) / 1e13,
      })),
    { rows: LABEL_ROWS, charWidth: 6.1, gap: 8, minX: plot.x, maxX: plot.x + plot.width }
  );

  const top = plot.y;
  const bottom = plot.y + plot.height;
  const placedLabels = Array.from(labels.values());
  const crossesLowerLabel = (x: number, row: number) =>
    placedLabels.some((l) => l.row < row && Math.abs(l.cx - x) <= l.width / 2 + 2);

  return (
    <g className="event-layer">
      {points.map(({ e, id, x }) => (
        <line
          key={`line-${id}`}
          x1={x}
          x2={x}
          y1={top}
          y2={bottom}
          stroke={EVENT_CATEGORY_COLORS[e.category]}
          strokeDasharray="2 4"
          strokeOpacity={id === activeId ? 0.9 : e.major ? 0.35 : 0.2}
          strokeWidth={id === activeId ? 2 : 1}
          pointerEvents="none"
        />
      ))}
      {points.map(({ e, id, x }) => {
        const placed = labels.get(id);
        if (!placed) return null;
        const baseline = top - 8 - placed.row * LABEL_ROW_HEIGHT;
        const color = EVENT_CATEGORY_COLORS[e.category];
        return (
          <g
            key={`label-${id}`}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect(id);
            }}
            style={{ cursor: 'pointer' }}
          >
            {placed.row > 0 && !crossesLowerLabel(x, placed.row) && (
              <line x1={x} x2={x} y1={baseline + 3} y2={top - 5} stroke={color} strokeOpacity={0.35} />
            )}
            <text
              x={placed.cx}
              y={baseline}
              textAnchor="middle"
              fontSize={10}
              fontFamily="monospace"
              fill={color}
              fillOpacity={id === activeId ? 1 : 0.85}
              fontWeight={id === activeId ? 'bold' : 'normal'}
            >
              {e.label}
            </text>
          </g>
        );
      })}
      {points.map(({ e, id, x }) => {
        const active = id === activeId;
        return (
          <g
            key={`dot-${id}`}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect(id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={x} cy={top} r={11} fill="transparent" />
            <circle
              cx={x}
              cy={top}
              r={active ? 6 : e.major ? 4.5 : 3.5}
              fill={EVENT_CATEGORY_COLORS[e.category]}
              fillOpacity={active ? 1 : e.major ? 0.9 : 0.6}
              stroke={active ? '#fff' : 'none'}
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </g>
  );
}
