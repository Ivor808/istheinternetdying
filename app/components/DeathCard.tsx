import type { ReactNode } from 'react';
import { formatDelta } from '@/data/death';
import { Skull } from './Logo';

// The Death Index at a glance: used on the dashboard, day pages and the embed

const C = {
  text: '#ececf1',
  muted: '#8b8b96',
  faint: '#2a2a33',
  line: '#1c1c24',
  bad: '#ff4d4d',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

interface Props {
  death: number | null;
  delta: number | null;
  band: [number, number] | null;
  deltaLabel?: string;
  // Right side of the header row
  actions?: ReactNode;
  children?: ReactNode;
}

export function DeathCard({ death, delta, band, deltaLabel = 'vs last week', actions, children }: Props) {
  const above = band !== null && death !== null && death > band[1];
  return (
    <section className="dc-card" aria-label="Death Index">
      <style dangerouslySetInnerHTML={{ __html: DC_CSS }} />
      <div className="dc-head">
        <span>Death Index</span>
        {actions && <span className="dc-actions">{actions}</span>}
      </div>
      <div className="dc-main">
        <Clock death={death ?? 0} bad={above} />
        <div>
          <div className="dc-value" style={{ color: above ? C.bad : C.text }}>
            {death ?? '—'}
            <span className="dc-outof">/100</span>
          </div>
          {delta !== null && (
            <div className="dc-delta" style={{ color: delta > 0 ? C.bad : C.muted }}>
              {formatDelta(delta)} {deltaLabel}
            </div>
          )}
        </div>
      </div>
      {death !== null && <ScaleBar value={death} band={band} />}
      {children}
    </section>
  );
}

function ScaleBar({ value, band }: { value: number; band: [number, number] | null }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  return (
    <div className="dc-scale">
      {band && (
        <div className="dc-scale-above">
          <span style={{ left: pct((band[0] + band[1]) / 2) }}>normal</span>
        </div>
      )}
      <div className="dc-track">
        {band && <div className="dc-band" style={{ left: pct(band[0]), width: pct(band[1] - band[0]) }} />}
        {/* Full-width layer shifted by the score, so the slide-in is a pure transform */}
        <div className="dc-marker-run" style={{ transform: `translateX(${pct(value)})` }}>
          <div className="dc-marker" style={{ background: band && value > band[1] ? C.bad : C.text }} />
        </div>
      </div>
      <div className="dc-scale-labels">
        <span>0</span>
        <span className={`dc-dead${band && value > band[1] ? ' is-bad' : ''}`}>
          100 <Skull size={13} color={band && value > band[1] ? C.bad : C.muted} />
        </span>
      </div>
    </div>
  );
}

// Hand sweeps from six o'clock (0) up to midnight (100)
// The hand is its own layer, rotated into place with a CSS transform, so the load-in sweep (down from midnight)
// runs on the compositor and stays smooth while the page is still hydrating
function Clock({ death, bad }: { death: number; bad: boolean }) {
  const degrees = 180 + (Math.max(0, Math.min(100, death)) / 100) * 180;
  const hand = bad ? C.bad : C.text;
  return (
    <div className="dc-clock" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke={C.faint} strokeWidth="3" />
        <line x1="50" y1="4" x2="50" y2="13" stroke={C.bad} strokeWidth="4" />
      </svg>
      <svg viewBox="0 0 100 100" className="dc-hand" style={{ transform: `rotate(${degrees}deg)` }}>
        <line x1="50" y1="50" x2="50" y2="16" stroke={hand} strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4" fill={hand} />
      </svg>
    </div>
  );
}

const DC_CSS = `
.dc-card { background: #101016; border: 1px solid ${C.line}; border-radius: 12px; padding: 1rem 1.25rem 1.1rem; min-width: 340px; color: ${C.text}; }
.dc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; font-size: 0.8rem; color: ${C.muted}; font-family: ${C.mono}; text-transform: uppercase; letter-spacing: 0.06em; }
.dc-actions { display: flex; gap: 0.9rem; text-transform: none; letter-spacing: 0; }
.dc-link { color: ${C.muted}; text-decoration: underline dotted; text-underline-offset: 3px; background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
.dc-link:hover { color: ${C.text}; }
.dc-main { display: flex; align-items: center; gap: 1rem; margin-top: 0.75rem; }
.dc-clock { position: relative; width: 84px; height: 84px; flex: none; }
.dc-clock svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dc-value { font-family: ${C.mono}; font-size: 3.75rem; font-weight: 700; line-height: 1; display: flex; align-items: baseline; }
.dc-outof { font-size: 1.1rem; font-weight: 400; color: ${C.muted}; margin-left: 0.25rem; }
.dc-delta { font-family: ${C.mono}; font-size: 0.75rem; margin-top: 0.45rem; }
.dc-scale { margin-top: 0.9rem; }
.dc-scale-above { position: relative; height: 1rem; font-family: ${C.mono}; font-size: 0.68rem; color: ${C.muted}; }
.dc-scale-above span { position: absolute; bottom: 0.15rem; transform: translateX(-50%); white-space: nowrap; }
.dc-track { position: relative; height: 6px; border-radius: 3px; background: ${C.line}; }
.dc-band { position: absolute; top: 0; bottom: 0; background: rgba(255,255,255,0.16); border-radius: 3px; }
.dc-marker-run { position: absolute; inset: 0; pointer-events: none; }
.dc-marker { position: absolute; left: 0; top: -5px; width: 3px; height: 16px; border-radius: 2px; transform: translateX(-50%); }
.dc-scale-labels { display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem; font-family: ${C.mono}; font-size: 0.68rem; color: ${C.muted}; }
.dc-dead { display: inline-flex; align-items: center; gap: 0.35rem; }
/* Load-in: hand and marker start at midnight / 100 and settle on the score; the skull pulses once if we land above normal */
.dc-hand { transform-origin: 50% 50%; will-change: transform; animation: dc-sweep 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
.dc-marker-run { will-change: transform; animation: dc-slide 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
.dc-dead.is-bad svg { will-change: transform; animation: dc-thump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 1.05s 1; }
@keyframes dc-sweep { from { transform: rotate(360deg); } }
@keyframes dc-slide { from { transform: translateX(100%); } }
@keyframes dc-thump { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.45); } }
@media (prefers-reduced-motion: reduce) {
  .dc-hand, .dc-marker-run, .dc-dead.is-bad svg { animation: none; }
}
@media (max-width: 720px) {
  .dc-card { min-width: 0; }
  .dc-value { font-size: 3rem; }
  .dc-clock { width: 72px; height: 72px; }
}
`;
