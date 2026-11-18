import { createRootRoute, Outlet, HeadContent, Scripts } from '@tanstack/react-router';
import { OG_IMAGE, SITE_NAME } from '@/data/site';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Is The Internet Dying? — The Death Index' },
      {
        name: 'description',
        content:
          'Tracking the slow heat death of the internet, one status page at a time. The Death Index aggregates SaaS reliability data into a single score.',
      },
      // Open Graph
      { property: 'og:title', content: 'Is The Internet Dying?' },
      { property: 'og:description', content: 'Tracking the slow heat death of the internet, one status page at a time. The Death Index — a composite reliability score for 50 major services.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Is the internet dying? The Death Index doomsday clock' },
      { name: 'theme-color', content: '#0a0a0f' },
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: OG_IMAGE },
      { name: 'twitter:title', content: 'Is The Internet Dying? — The Death Index' },
      { name: 'twitter:description', content: 'Tracking the slow heat death of the internet, one status page at a time.' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="60cd07b4-eb37-4b84-882a-d50f28544bd1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                background: #0a0a0f;
                color: #e0e0e0;
                font-family: system-ui, -apple-system, sans-serif;
                min-height: 100vh;
              }
              .dashboard {
                max-width: 900px;
                margin: 0 auto;
                padding: 2rem 1rem;
              }
            `,
          }}
        />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
