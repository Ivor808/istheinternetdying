import { createFileRoute } from '@tanstack/react-router';
import { getTodayCard } from '@/data/card';
import { badgeSvg } from '@/share/card-image';

// README badge: ![Death Index](https://istheinternetdying.com/badge.svg)
export const Route = createFileRoute('/badge.svg')({
  server: {
    handlers: {
      GET: async () => {
        const card = await getTodayCard().catch(() => null);
        return new Response(badgeSvg(card), {
          headers: {
            'Content-Type': 'image/svg+xml',
            // GitHub's image proxy respects this, so the badge stays roughly current
            'Cache-Control': 'public, max-age=3600',
          },
        });
      },
    },
  },
});
