import { useState } from 'react';
import {
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_LABELS,
  eventId,
  type TimelineEvent,
} from '@/data/events';
import { formatDate } from '@/data/chart';

interface EventTimelineProps {
  events: TimelineEvent[];
  activeId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

const COLLAPSED_COUNT = 8;

export function EventTimeline({ events, activeId, selectedId, onHover, onSelect }: EventTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedIdx = events.findIndex((e) => eventId(e) === selectedId);
  const showAll = expanded || selectedIdx >= COLLAPSED_COUNT;
  const shown = showAll ? events : events.slice(0, COLLAPSED_COUNT);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          color: '#888',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          marginBottom: '0.5rem',
        }}
      >
        events in range ({events.length})
      </div>
      {events.length === 0 ? (
        <div style={{ color: '#888', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          no events in this range
        </div>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {shown.map((e) => {
            const id = eventId(e);
            const active = id === activeId;
            const color = EVENT_CATEGORY_COLORS[e.category];
            return (
              <li
                key={id}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(id)}
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'baseline',
                  padding: '0.4rem 0.5rem',
                  borderLeft: `2px solid ${active ? color : 'transparent'}`,
                  background: active ? '#15151c' : 'transparent',
                  borderRadius: '0 4px 4px 0',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                    marginTop: '0.25rem',
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', color: '#999', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {formatDate(e.date)}
                  </span>
                  <span style={{ color: e.major ? '#e0e0e0' : '#aaa', fontSize: '0.85rem', fontWeight: e.major ? 600 : 400 }}>
                    {e.label}
                  </span>
                  <span
                    title={EVENT_CATEGORY_LABELS[e.category]}
                    style={{ color, fontSize: '0.7rem', fontFamily: 'monospace', marginLeft: '0.5rem', whiteSpace: 'nowrap' }}
                  >
                    {e.category}
                  </span>
                  {e.description && (
                    <span style={{ display: 'block', color: '#999', fontSize: '0.78rem', lineHeight: 1.4, marginTop: '0.1rem' }}>
                      {e.description}
                    </span>
                  )}
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(ev) => ev.stopPropagation()}
                      style={{
                        color: '#888',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        marginLeft: e.description ? 0 : '0.5rem',
                      }}
                    >
                      source ↗
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {events.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: '0.5rem',
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
          }}
        >
          {showAll ? 'show fewer ▴' : `show all ${events.length} ▾`}
        </button>
      )}
    </div>
  );
}
