import { createFileRoute } from '@tanstack/react-router';
import { todayJson } from '@/data/public-api';

// /api/today.json: the latest Death Index and what's broken right now
export const Route = createFileRoute('/api/today.json')({
  server: {
    handlers: {
      GET: async () => {
        const body = await todayJson();
        if (!body) return Response.json({ error: 'No data yet' }, { status: 503 });
        return Response.json(body, {
          headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
        });
      },
    },
  },
});
