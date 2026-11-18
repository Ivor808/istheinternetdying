import { afterEach, describe, expect, it, vi } from 'vitest';

// Fresh module per test so the in-memory cache starts empty
async function load() {
  vi.resetModules();
  return import('@/data/live-status');
}

function respond(indicator: string | null) {
  return vi.fn(async () =>
    indicator === null
      ? new Response('nope', { status: 503 })
      : new Response(JSON.stringify({ status: { indicator, description: 'x' } }), { status: 200 })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLiveStatus', () => {
  it('reads each provider indicator', async () => {
    vi.stubGlobal('fetch', respond('minor'));
    const { getLiveStatus, isIssue } = await load();
    const status = await getLiveStatus();
    expect(status.services.length).toBeGreaterThan(40);
    expect(status.services.every((s) => s.indicator === 'minor')).toBe(true);
    expect(status.failed).toBe(0);
    expect(isIssue('minor')).toBe(true);
    expect(isIssue('maintenance')).toBe(false);
  });

  it('marks unreachable or unrecognised pages as unknown', async () => {
    vi.stubGlobal('fetch', respond(null));
    const { getLiveStatus } = await load();
    const status = await getLiveStatus();
    expect(status.failed).toBe(status.services.length);

    vi.stubGlobal('fetch', respond('on_fire'));
    const again = await (await load()).getLiveStatus();
    expect(again.services.every((s) => s.indicator === 'unknown')).toBe(true);
  });

  it('serves one shared check until it goes stale', async () => {
    const fetchMock = respond('none');
    vi.stubGlobal('fetch', fetchMock);
    const { getLiveStatus, LIVE_TTL_MS } = await load();

    const [a, b] = await Promise.all([getLiveStatus(), getLiveStatus()]);
    expect(a).toBe(b);
    const perCheck = fetchMock.mock.calls.length;

    await getLiveStatus(Date.parse(a.checkedAt) + LIVE_TTL_MS - 1);
    expect(fetchMock.mock.calls.length).toBe(perCheck);

    await getLiveStatus(Date.parse(a.checkedAt) + LIVE_TTL_MS + 1);
    expect(fetchMock.mock.calls.length).toBe(perCheck * 2);
  });
});
