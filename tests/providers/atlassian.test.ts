import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapImpactToSeverity,
  parseAtlassianIncident,
  atlassianProvider,
} from '../../src/providers/atlassian';

describe('atlassian provider', () => {
  describe('mapImpactToSeverity', () => {
    it('maps none to minor', () => {
      expect(mapImpactToSeverity('none')).toBe('minor');
    });

    it('maps minor to minor', () => {
      expect(mapImpactToSeverity('minor')).toBe('minor');
    });

    it('maps major to major', () => {
      expect(mapImpactToSeverity('major')).toBe('major');
    });

    it('maps critical to critical', () => {
      expect(mapImpactToSeverity('critical')).toBe('critical');
    });

    it('defaults unknown values to minor', () => {
      expect(mapImpactToSeverity('unknown')).toBe('minor');
    });
  });

  describe('parseAtlassianIncident', () => {
    it('parses a resolved incident', () => {
      const raw = {
        id: 'abc123',
        name: 'API degradation',
        impact: 'major',
        created_at: '2026-01-15T10:00:00.000Z',
        resolved_at: '2026-01-15T14:00:00.000Z',
        status: 'resolved',
      };

      const result = parseAtlassianIncident(raw);

      expect(result).toEqual({
        externalId: 'abc123',
        title: 'API degradation',
        severity: 'major',
        startedAt: new Date('2026-01-15T10:00:00.000Z'),
        resolvedAt: new Date('2026-01-15T14:00:00.000Z'),
        raw,
      });
    });

    it('parses an unresolved incident with null resolved_at', () => {
      const raw = {
        id: 'def456',
        name: 'Ongoing issue',
        impact: 'critical',
        created_at: '2026-03-30T08:00:00.000Z',
        resolved_at: null,
        status: 'investigating',
      };

      const result = parseAtlassianIncident(raw);

      expect(result.resolvedAt).toBeNull();
      expect(result.severity).toBe('critical');
    });
  });

  describe('atlassianProvider.fetchIncidents', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches and parses incidents from a single page', async () => {
      const mockIncidents = [
        {
          id: 'inc1',
          name: 'Outage',
          impact: 'major',
          created_at: '2026-03-01T10:00:00.000Z',
          resolved_at: '2026-03-01T12:00:00.000Z',
          status: 'resolved',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ incidents: mockIncidents }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await atlassianProvider.fetchIncidents(
        'https://status.example.com',
        new Date('2026-01-01T00:00:00.000Z')
      );

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe('inc1');
      expect(result[0].severity).toBe('major');
      expect(fetch).toHaveBeenCalledWith(
        'https://status.example.com/api/v2/incidents.json?page=1&per_page=100'
      );
    });

    it('stops paginating when incidents are older than since date', async () => {
      const oldIncident = {
        id: 'old1',
        name: 'Old issue',
        impact: 'minor',
        created_at: '2025-06-01T10:00:00.000Z',
        resolved_at: '2025-06-01T11:00:00.000Z',
        status: 'resolved',
      };

      const newIncident = {
        id: 'new1',
        name: 'New issue',
        impact: 'minor',
        created_at: '2026-02-01T10:00:00.000Z',
        resolved_at: '2026-02-01T11:00:00.000Z',
        status: 'resolved',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ incidents: [newIncident, oldIncident] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await atlassianProvider.fetchIncidents(
        'https://status.example.com',
        new Date('2026-01-01T00:00:00.000Z')
      );

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe('new1');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
