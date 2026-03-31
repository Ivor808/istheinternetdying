import { createRootRoute, Outlet, HeadContent, Scripts } from '@tanstack/react-router';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Doomsd.ai — Service Reliability Index' },
      {
        name: 'description',
        content:
          'Is the internet getting worse? Track SaaS reliability with the Doomsday Index.',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
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
