import { describe, it, expect, vi } from 'vitest';

// Mock db before importing daily-sync
vi.mock('../../src/db/client', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/providers/registry', () => ({
  getProvider: vi.fn(),
}));

describe('runDailySync', () => {
  it('exports runDailySync as a function', async () => {
    const { runDailySync } = await import('../../src/cron/daily-sync');
    expect(typeof runDailySync).toBe('function');
  });
});
