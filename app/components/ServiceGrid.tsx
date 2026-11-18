import { useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceGrid as Grid } from '@/data/service-grid';
import { formatDate } from '@/data/chart';
import { CATEGORY_NAMES, CATEGORY_ORDER } from '@/data/categories';

const SEVERITY = ['', 'minor', 'major', 'critical'];

// Layout in SVG units; the SVG scales to its container width.
// Phones show fewer days, so the same units render larger there.
const CELL = 10;
const BAR_H = 40;
const BAR_GAP = 8;
const AXIS_H = 18;

const EMPTY = '#16161d';
// Each step is clearly lighter than the last, so severity reads without relying on hue
export const GRID_SCALE = ['#4d3338', '#8f3b46', '#d6434f', '#ffa08a'];

// Single service: by that day's score
function serviceColor(score: number, hours: number): string {
  if (hours === 0) return EMPTY;
  if (score >= 95) return GRID_SCALE[0];
  if (score >= 85) return GRID_SCALE[1];
  if (score >= 70) return GRID_SCALE[2];
  return GRID_SCALE[3];
}

// Category: by the share of its services hit that day
function categoryColor(hit: number, total: number): string {
  if (hit === 0) return EMPTY;
  const share = hit / total;
  if (share <= 0.1) return GRID_SCALE[0];
  if (share <= 0.25) return GRID_SCALE[1];
  if (share <= 0.5) return GRID_SCALE[2];
  return GRID_SCALE[3];
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

interface Row {
  key: string;
  label: string;
  total: number;
  y: number;
  height: number;
  open: boolean;
  category?: string;
  color: (day: number) => string;
  describe: (day: number) => string;
}

export function ServiceGrid({ grid }: { grid: Grid }) {
  const [filter, setFilter] = useState<string | null>(null);
  const mobile = useIsMobile();
  const visibleDays = mobile ? Math.min(30, grid.days.length) : grid.days.length;
  const LABEL_W = mobile ? 112 : 96;
  const TOTAL_W = mobile ? 40 : 36;
  const font = mobile ? 12 : 9;
  const offset = grid.days.length - visibleDays;
  const days = grid.days.slice(offset);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((c) => grid.services.some((s) => s.category === c)),
    [grid.services]
  );
  const scope = useMemo(
    () => (filter ? grid.services.filter((s) => s.category === filter) : grid.services),
    [grid.services, filter]
  );

  const { rows, height } = useMemo(() => {
    const sumHours = (hours: number[]) => hours.slice(offset).reduce((a, b) => a + b, 0);
    const unplaced: Array<Omit<Row, 'y' | 'height'>> = [];
    if (filter) {
      for (const s of grid.services.filter((x) => x.category === filter)) {
        unplaced.push({
          key: s.slug,
          label: s.name,
          total: sumHours(s.hours),
          open: s.openNow,
          color: (d) => serviceColor(s.scores[d], s.hours[d]),
          describe: (d) => (s.hours[d] > 0 ? `${s.hours[d]}h ${SEVERITY[s.worst[d]]}` : 'no incidents'),
        });
      }
    } else {
      for (const cat of categories) {
        const services = grid.services.filter((s) => s.category === cat);
        const hitOn = (d: number) => services.filter((s) => s.hours[d] > 0).length;
        const hoursOn = (d: number) => Math.round(services.reduce((a, s) => a + s.hours[d], 0) * 10) / 10;
        unplaced.push({
          key: cat,
          label: CATEGORY_NAMES[cat] ?? cat,
          total: services.reduce((a, s) => a + sumHours(s.hours), 0),
          open: services.some((s) => s.openNow),
          category: cat,
          color: (d) => categoryColor(hitOn(d), services.length),
          describe: (d) => (hitOn(d) > 0 ? `${hitOn(d)}/${services.length} services · ${hoursOn(d)}h` : 'no incidents'),
        });
      }
    }

    // Worst first, so the y-axis reads as a ranking
    unplaced.sort((a, b) => b.total - a.total);
    const rowH = filter ? (mobile ? 15 : 11) : mobile ? 22 : 16;
    const step = rowH + (filter ? 3 : mobile ? 5 : 4);
    const rows: Row[] = unplaced.map((r, i) => ({ ...r, y: BAR_H + BAR_GAP + i * step, height: rowH }));
    return { rows, height: BAR_H + BAR_GAP + rows.length * step - (step - rowH) + AXIS_H };
  }, [grid.services, filter, categories, offset, mobile]);

  // Total hours down per day across the current scope
  const totals = useMemo(
    () => grid.days.map((_, d) => scope.reduce((a, s) => a + s.hours[d], 0)),
    [grid.days, scope]
  );
  const maxTotal = Math.max(1, ...totals.slice(offset));

  const width = LABEL_W + days.length * CELL + TOTAL_W;
  const gridBottom = height - AXIS_H;
  const lastX = LABEL_W + (days.length - 1) * CELL;
  const monthStarts = days.flatMap((d, i) => (d.endsWith('-01') && i > 0 ? [i] : []));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const ux = ((e.clientX - box.left) / box.width) * width;
    const uy = ((e.clientY - box.top) / box.height) * height;
    const col = Math.floor((ux - LABEL_W) / CELL);
    // Row -1 is the totals strip
    const row = uy < BAR_H + BAR_GAP / 2 ? -1 : rows.findIndex((r) => uy >= r.y - 2 && uy < r.y + r.height + 2);
    setHover(col >= 0 && col < days.length && (row >= 0 || row === -1) ? { row, col } : null);
  };

  const onClick = () => {
    if (!hover || hover.row < 0) return;
    const cat = rows[hover.row]?.category;
    if (cat) setFilter(cat);
  };

  const hDay = hover ? offset + hover.col : 0;
  const hRow = hover && hover.row >= 0 ? rows[hover.row] : null;
  const tipY = hRow ? hRow.y + hRow.height : BAR_H;
  const hovered = hover ? { row: hRow, y: tipY } : null;

  return (
    <div>
      <div className="grid-filters" role="group" aria-label="Filter by category">
        <button className={`ui-seg${filter === null ? ' is-active' : ''}`} aria-pressed={filter === null} onClick={() => setFilter(null)}>
          All
        </button>
        {categories.map((c) => (
          <button key={c} className={`ui-seg${filter === c ? ' is-active' : ''}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
            {CATEGORY_NAMES[c] ?? c}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginTop: '0.75rem' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: hRow?.category ? 'pointer' : 'default' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
          role="img"
          aria-label={`Daily incidents for ${scope.length} services over the last ${days.length} days`}
        >
          {/* Hours down per day */}
          <text x={0} y={10} fontSize={mobile ? 10 : 8} fill="#8b8b96" fontFamily="ui-monospace, monospace">
            hours down
          </text>
          <text x={LABEL_W - 4} y={10} fontSize={mobile ? 10 : 8} fill="#8b8b96" textAnchor="end" fontFamily="ui-monospace, monospace">
            {Math.round(maxTotal)}h
          </text>
          {days.map((_, c) => {
            const h = (totals[offset + c] / maxTotal) * BAR_H;
            return (
              <rect
                key={`bar-${c}`}
                x={LABEL_W + c * CELL}
                y={BAR_H - h}
                width={CELL - 2}
                height={Math.max(h, 0.5)}
                rx={1}
                fill={hover?.col === c ? '#ececf1' : '#4a4a55'}
              />
            );
          })}

          <text x={width} y={BAR_H} fontSize={mobile ? 10 : 8} fill="#8b8b96" textAnchor="end" fontFamily="ui-monospace, monospace">
            {days.length}d
          </text>

          {/* Month separators */}
          {monthStarts.map((i) => (
            <line key={`m-${i}`} x1={LABEL_W + i * CELL - 1} x2={LABEL_W + i * CELL - 1} y1={0} y2={gridBottom} stroke="#2a2a33" strokeWidth={0.75} />
          ))}

          {rows.map((r, ri) => (
            <g key={r.key}>
              <text
                x={LABEL_W - 6}
                y={r.y + r.height / 2 + font / 3}
                fontSize={font}
                fill={hover?.row === ri ? '#ececf1' : '#8b8b96'}
                textAnchor="end"
                fontFamily="system-ui, sans-serif"
              >
                {r.label}
              </text>
              {days.map((_, c) => (
                <rect
                  key={c}
                  x={LABEL_W + c * CELL}
                  y={r.y}
                  width={CELL - 2}
                  height={r.height}
                  rx={1.5}
                  fill={r.color(offset + c)}
                  opacity={hover && hover.col !== c && hover.row !== ri ? 0.6 : 1}
                />
              ))}
              <text
                x={width}
                y={r.y + r.height / 2 + font / 3}
                fontSize={font}
                fill={hover?.row === ri ? '#ececf1' : '#8b8b96'}
                textAnchor="end"
                fontFamily="ui-monospace, monospace"
              >
                {Math.round(r.total)}h
              </text>
              {r.open && (
                <rect
                  className="grid-open"
                  x={lastX - 1}
                  y={r.y - 1}
                  width={CELL}
                  height={r.height + 2}
                  rx={2}
                  fill="none"
                  stroke="#ff4d4d"
                  strokeWidth={1.2}
                />
              )}
            </g>
          ))}

          {monthStarts.map((i) => (
            <text key={`ml-${i}`} x={LABEL_W + i * CELL} y={height - 3} fontSize={font} fill="#8b8b96" fontFamily="ui-monospace, monospace">
              {formatDate(days[i]).split(' ')[0]}
            </text>
          ))}
          <text x={lastX + CELL - 2} y={height - 3} fontSize={font} fill="#ececf1" textAnchor="end" fontFamily="ui-monospace, monospace">
            today
          </text>
        </svg>

        {hover && hovered && (
          <div
            style={{
              position: 'absolute',
              left: `${((LABEL_W + hover.col * CELL) / width) * 100}%`,
              top: `${(hovered.y / height) * 100}%`,
              transform: hover.col > days.length / 2 ? 'translate(calc(-100% - 8px), 6px)' : 'translate(14px, 6px)',
              background: '#14141b',
              border: '1px solid #2a2a33',
              borderRadius: 6,
              padding: '0.35rem 0.55rem',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <div style={{ color: '#ececf1' }}>
              {hRow ? hRow.label : filter ? CATEGORY_NAMES[filter] : 'All services'} · {formatDate(grid.days[hDay])}
            </div>
            <div style={{ color: '#8b8b96' }}>
              {hRow
                ? hRow.describe(hDay)
                : `${scope.filter((s) => s.hours[hDay] > 0).length}/${scope.length} services · ${Math.round(totals[hDay] * 10) / 10}h`}
            </div>
            {hRow?.category && <div style={{ color: '#8b8b96' }}>click to expand</div>}
          </div>
        )}
      </div>
    </div>
  );
}
