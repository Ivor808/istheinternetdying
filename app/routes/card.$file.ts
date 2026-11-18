import { createFileRoute } from '@tanstack/react-router';
import { cardFromDay, getTodayCard, type CardData } from '@/data/card';
import { getDay } from '@/data/day';
import { cardPng } from '@/share/card-image';

// /card/today.png: latest score with what's broken right now (for link previews and sharing)
// /card/2026-11-13.png: a past day's card

const TODAY_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { png: Uint8Array; at: number }>();

async function render(key: string, load: () => Promise<CardData | null>, ttl: number): Promise<Uint8Array | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.png;
  const card = await load();
  if (!card) return null;
  const png = await cardPng(card);
  if (cache.size > 200) cache.clear();
  cache.set(key, { png, at: Date.now() });
  return png;
}

export const Route = createFileRoute('/card/$file')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const match = /^(today|\d{4}-\d{2}-\d{2})\.png$/.exec(params.file);
        if (!match) return new Response('Not found', { status: 404 });
        const key = match[1];
        const today = key === 'today';
        const png = today
          ? await render('today', getTodayCard, TODAY_TTL_MS)
          : // Past days can still change until the trailing recompute settles, so re-render daily
            await render(key, async () => {
              const day = await getDay(key);
              return day ? cardFromDay(day) : null;
            }, 24 * 60 * 60 * 1000);
        if (!png) return new Response('Not found', { status: 404 });
        return new Response(png as BodyInit, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': today ? 'public, max-age=300' : 'public, max-age=86400',
          },
        });
      },
    },
  },
});
