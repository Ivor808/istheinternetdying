import { createFileRoute } from '@tanstack/react-router';
import { getNotableDays } from '@/data/day';
import { SITE_URL } from '@/data/site';

// Home, methodology, and only the notable day pages; ordinary days are noindex
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const days = await getNotableDays();
        const urls = [
          `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
          `<url><loc>${SITE_URL}/methodology</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
          ...days.reverse().map((d) => `<url><loc>${SITE_URL}/day/${d}</loc><priority>0.6</priority></url>`),
        ];
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
          { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } }
        );
      },
    },
  },
});
