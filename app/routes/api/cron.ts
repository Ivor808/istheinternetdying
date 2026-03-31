import { createFileRoute } from '@tanstack/react-router';
import { runDailySync } from '@/cron/daily-sync';

export const Route = createFileRoute('/api/cron')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
