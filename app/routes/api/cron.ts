import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'crypto';
import { runDailySync } from '@/cron/daily-sync';

function verifyAuth(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('CRON_SECRET is not set');
    return false;
  }
  const expected = `Bearer ${secret}`;
  const actual = (authHeader ?? '').trim();
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export const Route = createFileRoute('/api/cron')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyAuth(request.headers.get('authorization'))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        console.log('[cron] Sync request received, running in background...');

        // Fire and forget — Railway has a 10min first-byte timeout,
        // and backfill can take 15+ minutes. Return immediately.
        runDailySync()
          .then((result) => {
            console.log('[cron] Sync completed:', JSON.stringify(result));
          })
          .catch((err) => {
            console.error('[cron] Sync failed:', err);
          });

        return new Response(
          JSON.stringify({ success: true, message: 'Sync started' }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
    },
  },
});
