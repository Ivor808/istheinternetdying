import { createFileRoute } from '@tanstack/react-router';
import { llmsTxt } from '@/data/public-api';

// /llms.txt: a plain-text guide to the site for AI assistants (llmstxt.org)
export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () =>
        new Response(await llmsTxt(), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        }),
    },
  },
});
