import { createFileRoute } from '@tanstack/react-router';
import { dayJson } from '@/data/public-api';

// /api/day/2026-11-13.json: one day's score, summary and incidents
export const Route = createFileRoute('/api/day/$file')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const match = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(params.file);
        const body = match ? await dayJson(match[1]) : null;
        if (!body) return Response.json({ error: 'No such day' }, { status: 404 });
        return Response.json(body, {
          headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
        });
      },
    },
  },
});
