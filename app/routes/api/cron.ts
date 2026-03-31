import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'crypto';
import { runDailySync } from '@/cron/daily-sync';

function verifyAuth(authHeader: string | null): boolean {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
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

        let result;
        try {
          result = await runDailySync();
        } catch (err) {
          console.error('runDailySync failed:', err);
          return new Response(
            JSON.stringify({
              success: false,
              error: process.env.NODE_ENV === 'production' ? 'Internal server error' : String(err),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            backfilled: result.backfilled,
            globalScore: result.globalScore,
            categoryScores: result.categoryScores,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
    },
  },
});
