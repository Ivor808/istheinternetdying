import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapImpactToSeverity,
  parseAtlassianIncident,
  isRealOutage,
  atlassianProvider,
} from '../../src/providers/atlassian';

// validateStatusPageUrl is not exported, but we test it via fetchIncidents
describe('atlassian provider', () => {
  describe('URL validation (via fetchIncidents)', () => {
    it('rejects http URLs', async () => {
      await expect(
        atlassianProvider.fetchIncidents('http://status.example.com')
      ).rejects.toThrow('Only HTTPS URLs are allowed');
    });

    it('rejects localhost', async () => {
      await expect(
        atlassianProvider.fetchIncidents('https://localhost:5432')
      ).rejects.toThrow('Private/internal URLs are not allowed');
    });

    it('rejects private IPs', async () => {
      await expect(
        atlassianProvider.fetchIncidents('https://192.168.1.1')
      ).rejects.toThrow('Private/internal URLs are not allowed');
      await expect(
        atlassianProvider.fetchIncidents('https://10.0.0.1')
      ).rejects.toThrow('Private/internal URLs are not allowed');
      await expect(
        atlassianProvider.fetchIncidents('https://127.0.0.1')
      ).rejects.toThrow('Private/internal URLs are not allowed');
    });
  });

  describe('mapImpactToSeverity', () => {
    it('maps minor to minor', () => {
      expect(mapImpactToSeverity('minor')).toBe('minor');
    });

    it('maps major to major', () => {
      expect(mapImpactToSeverity('major')).toBe('major');
    });

    it('maps critical to critical', () => {
      expect(mapImpactToSeverity('critical')).toBe('critical');
    });

    it('returns null for maintenance, none and unknown values', () => {
      expect(mapImpactToSeverity('maintenance')).toBeNull();
      expect(mapImpactToSeverity('none')).toBeNull();
      expect(mapImpactToSeverity('unknown')).toBeNull();
    });
  });

  describe('isRealOutage', () => {
    it('returns true for minor impact', () => {
      expect(isRealOutage({ id: '1', name: 'test', impact: 'minor', created_at: '', resolved_at: null, status: 'resolved', components: [] })).toBe(true);
    });

    it('returns true for major impact', () => {
      expect(isRealOutage({ id: '1', name: 'test', impact: 'major', created_at: '', resolved_at: null, status: 'resolved', components: [] })).toBe(true);
    });

    it('returns true for critical impact', () => {
      expect(isRealOutage({ id: '1', name: 'test', impact: 'critical', created_at: '', resolved_at: null, status: 'resolved', components: [] })).toBe(true);
    });

    it('returns false for maintenance impact', () => {
      expect(isRealOutage({ id: '1', name: 'DB upgrade', impact: 'maintenance', created_at: '', resolved_at: null, status: 'completed', components: [] })).toBe(false);
    });

    it('returns false for unknown impact', () => {
      expect(isRealOutage({ id: '1', name: 'test', impact: 'catastrophic', created_at: '', resolved_at: null, status: 'resolved', components: [] })).toBe(false);
    });

    it('returns false for none impact (informational)', () => {
      expect(isRealOutage({ id: '1', name: 'Scheduled rollout', impact: 'none', created_at: '', resolved_at: null, status: 'resolved', components: [] })).toBe(false);
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

    it('falls back to created_at when started_at is blank, and rejects unreadable times', () => {
      const base = { id: 'x1', name: 'Blip', impact: 'minor', created_at: '2026-01-15T10:00:00.000Z', resolved_at: null, status: 'resolved' };
      expect(parseAtlassianIncident({ ...base, started_at: '' }).startedAt).toEqual(new Date('2026-01-15T10:00:00.000Z'));
      expect(() => parseAtlassianIncident({ ...base, started_at: 'nope', created_at: 'nope' })).toThrow('No usable start time');
      expect(() => parseAtlassianIncident({ ...base, resolved_at: 'nope' })).toThrow('Unreadable resolved_at');
    });

    it('uses started_at when the provider backdates the start', () => {
      const raw = {
        id: 'gh1',
        name: 'Degraded Actions',
        impact: 'minor',
        created_at: '2026-01-15T10:30:00.000Z',
        started_at: '2026-01-15T09:45:00.000Z',
        resolved_at: '2026-01-15T11:00:00.000Z',
        status: 'resolved',
      };
      expect(parseAtlassianIncident(raw).startedAt).toEqual(new Date('2026-01-15T09:45:00.000Z'));
    });

    it('falls back to created_at when started_at is missing or null', () => {
      const raw = {
        id: 'x1',
        name: 'Issue',
        impact: 'minor',
        created_at: '2026-01-15T10:30:00.000Z',
        started_at: null,
        resolved_at: null,
        status: 'investigating',
      };
      expect(parseAtlassianIncident(raw).startedAt).toEqual(new Date('2026-01-15T10:30:00.000Z'));
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

    const respond = (incidents: unknown[]) =>
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ incidents }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const incident = (id: string, impact: string, createdAt: string) => ({
      id,
      name: id,
      impact,
      created_at: createdAt,
      started_at: createdAt,
      resolved_at: null,
      status: 'resolved',
      components: [],
    });

    it('fetches and parses incidents with one unpaginated request', async () => {
      respond([
        {
          id: 'inc1',
          name: 'Outage',
          impact: 'major',
          created_at: '2026-03-01T10:00:00.000Z',
          resolved_at: '2026-03-01T12:00:00.000Z',
          status: 'resolved',
        },
      ]);

      const result = await atlassianProvider.fetchIncidents('https://status.example.com');

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].externalId).toBe('inc1');
      expect(result.incidents[0].severity).toBe('major');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://status.example.com/api/v2/incidents.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('does not request more pages when the feed is full', async () => {
      // The API ignores ?page, so a full page of 50 used to loop 20 times
      const full = Array.from({ length: 50 }, (_, i) =>
        incident(`i${i}`, 'minor', new Date(Date.UTC(2026, 2, 1) - i * 86400000).toISOString())
      );
      respond(full);

      const result = await atlassianProvider.fetchIncidents('https://status.example.com');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.incidents).toHaveLength(50);
    });

    it('keeps old incidents so later resolutions are refreshed', async () => {
      respond([
        incident('new1', 'minor', '2026-02-01T10:00:00.000Z'),
        incident('old1', 'minor', '2025-06-01T10:00:00.000Z'),
      ]);

      const result = await atlassianProvider.fetchIncidents('https://status.example.com');

      expect(result.incidents.map((i) => i.externalId)).toEqual(['new1', 'old1']);
    });

    it('filters none, maintenance and unknown impacts, and reports them as excluded', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      respond([
        incident('real1', 'major', '2026-03-03T10:00:00.000Z'),
        incident('info1', 'none', '2026-03-02T10:00:00.000Z'),
        incident('maint1', 'maintenance', '2026-03-01T10:00:00.000Z'),
        incident('odd1', 'catastrophic', '2026-02-28T10:00:00.000Z'),
      ]);

      const result = await atlassianProvider.fetchIncidents('https://status.example.com');

      expect(result.incidents.map((i) => i.externalId)).toEqual(['real1']);
      expect(result.excludedIds).toEqual(['info1', 'maint1', 'odd1']);
      // Only the unknown impact is worth a warning
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('catastrophic');
    });

    it('reports the oldest listed incident, filtered ones included', async () => {
      respond([
        incident('real1', 'minor', '2026-03-03T10:00:00.000Z'),
        incident('maint1', 'maintenance', '2026-01-10T10:00:00.000Z'),
      ]);

      const result = await atlassianProvider.fetchIncidents('https://status.example.com');

      expect(result.oldestListedAt).toEqual(new Date('2026-01-10T10:00:00.000Z'));
    });

    it('reports no oldest incident for an empty feed', async () => {
      respond([]);

      const result = await atlassianProvider.fetchIncidents('https://status.example.com');

      expect(result).toEqual({ incidents: [], excludedIds: [], oldestListedAt: null });
    });
  });
});
