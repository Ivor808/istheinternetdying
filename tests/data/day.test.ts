import { describe, expect, it, vi } from 'vitest';

// The pure rules only; keep the database client out of it
vi.mock('@/db/client', () => ({ db: {} }));
const { hoursWithinDay, isNotable, majorServicesByDate, notableDates, sortIncidents, NOTABLE_RISE, NOTABLE_SERVICES } =
  await import('@/data/day');

const at = (s: string) => new Date(`${s}Z`);
const now = at('2026-11-20T00:00:00');

describe('hoursWithinDay', () => {
  it('clips an incident to the day', () => {
    const i = { startedAt: at('2026-11-12T22:00:00'), resolvedAt: at('2026-11-13T03:00:00') };
    expect(hoursWithinDay(i, '2026-11-12', now)).toBe(2);
    expect(hoursWithinDay(i, '2026-11-13', now)).toBe(3);
    expect(hoursWithinDay(i, '2026-11-14', now)).toBe(0);
  });

  it('caps open incidents at a week', () => {
    const i = { startedAt: at('2026-11-01T00:00:00'), resolvedAt: null };
    expect(hoursWithinDay(i, '2026-11-07', now)).toBe(24);
    expect(hoursWithinDay(i, '2026-11-08', now)).toBe(0);
  });
});

describe('isNotable', () => {
  const quiet = { events: [], majorServices: 0, rise: 0 };
  it('needs an outage event, several serious incidents, or a sharp rise', () => {
    expect(isNotable(quiet)).toBe(false);
    expect(isNotable({ ...quiet, events: [{ date: '2026-11-13', label: 'FAA', category: 'outage' as const }] })).toBe(true);
    expect(isNotable({ ...quiet, events: [{ date: '2026-11-13', label: 'Model', category: 'model' as const }] })).toBe(false);
    expect(isNotable({ ...quiet, majorServices: NOTABLE_SERVICES })).toBe(true);
    expect(isNotable({ ...quiet, majorServices: NOTABLE_SERVICES - 1 })).toBe(false);
    expect(isNotable({ ...quiet, rise: NOTABLE_RISE })).toBe(true);
    expect(isNotable({ ...quiet, rise: null })).toBe(false);
  });
});

describe('majorServicesByDate', () => {
  it('counts distinct services with major or worse incidents on each day they touch', () => {
    const base = { name: 'x', title: 't' };
    const map = majorServicesByDate(
      [
        { ...base, slug: 'a', severity: 'major', startedAt: at('2026-11-12T23:00:00'), resolvedAt: at('2026-11-13T01:00:00') },
        { ...base, slug: 'a', severity: 'critical', startedAt: at('2026-11-13T05:00:00'), resolvedAt: at('2026-11-13T06:00:00') },
        { ...base, slug: 'b', severity: 'minor', startedAt: at('2026-11-13T05:00:00'), resolvedAt: at('2026-11-13T06:00:00') },
      ],
      now
    );
    expect(map.get('2026-11-12')?.size).toBe(1);
    expect(map.get('2026-11-13')?.size).toBe(1);
    expect(map.has('2026-11-14')).toBe(false);
  });
});

describe('notableDates', () => {
  it('flags a sharp rise in the Death Index', () => {
    const history = [
      { date: '2026-11-01', globalScore: 90 },
      { date: '2026-11-02', globalScore: 90 - NOTABLE_RISE },
      { date: '2026-11-03', globalScore: 90 },
    ];
    expect(notableDates(history, new Map())).toEqual(['2026-11-02']);
  });
});

describe('sortIncidents', () => {
  it('puts the worst first, then familiar names', () => {
    const mk = (slug: string, severity: 'minor' | 'major' | 'critical', hours = 1) => ({
      slug, name: slug, title: '', severity, startedAt: '', resolvedAt: null, hours, statusUrl: null,
    });
    const sorted = sortIncidents([mk('retool', 'major'), mk('npm', 'minor', 9), mk('openai', 'major'), mk('box', 'critical')]);
    expect(sorted.map((i) => i.slug)).toEqual(['box', 'openai', 'retool', 'npm']);
  });
});
