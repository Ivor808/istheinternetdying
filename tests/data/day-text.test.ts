import { describe, expect, it } from 'vitest';
import { daySummary, listNames } from '../../src/data/day-text';
import type { DayData, DayIncident } from '../../src/data/day';

const incident = (slug: string, name: string, hours: number, title = 'Elevated errors'): DayIncident => ({
  slug,
  name,
  title,
  severity: 'major',
  startedAt: '2026-11-13T10:00:00.000Z',
  resolvedAt: '2026-11-13T12:00:00.000Z',
  hours,
  statusUrl: null,
});

const day = (over: Partial<DayData>): DayData => ({
  date: '2026-11-13',
  death: 12.4,
  weekBefore: 5.2,
  band: [8, 10],
  incidents: [],
  events: [],
  notable: false,
  prev: null,
  next: null,
  ...over,
});

describe('listNames', () => {
  it('joins with commas and "and"', () => {
    expect(listNames(['A'])).toBe('A');
    expect(listNames(['A', 'B'])).toBe('A and B');
    expect(listNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('daySummary', () => {
  it('names services, the longest incident and the index', () => {
    const text = daySummary(
      day({
        incidents: [
          incident('openai', 'ChatGPT', 2),
          incident('openai', 'ChatGPT', 0.5),
          incident('github', 'GitHub', 3.25, 'Actions delayed'),
          incident('slack', 'Slack', 0.2),
          incident('zoom', 'Zoom', 1),
        ],
      })
    );
    expect(text).toMatch(/^On Nov 13, 2026, 4 of the \d+ services we track reported incidents, including ChatGPT, GitHub and Slack\./);
    expect(text).toContain(`The longest was GitHub's "Actions delayed", open 3.3 hours that day.`);
    expect(text).toContain('The Death Index was 12/100 (higher is worse), up 7 from a week earlier, above its normal range.');
  });

  it('handles a quiet day', () => {
    const text = daySummary(day({ death: 9, weekBefore: null }));
    expect(text).toMatch(/none of the \d+ services we track reported an incident\./);
    expect(text).toContain('The Death Index was 9/100 (higher is worse), within its normal range.');
  });
});
