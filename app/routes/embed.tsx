import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getTodayCard } from '@/data/card';
import { SITE_URL } from '@/data/site';
import { DeathCard } from '../components/DeathCard';

// The Death Index card on its own, for other sites to iframe. The whole card links home.

const loadCard = createServerFn().handler(async () => getTodayCard());

export const Route = createFileRoute('/embed')({
  loader: async () => loadCard(),
  head: () => ({
    meta: [{ title: 'Death Index — Is The Internet Dying?' }, { name: 'robots', content: 'noindex' }],
    links: [{ rel: 'canonical', href: `${SITE_URL}/` }],
  }),
  component: Embed,
});

const MAX_NAMES = 3;

function Embed() {
  const card = Route.useLoaderData();
  const names = card?.services ?? [];
  const more = names.length - MAX_NAMES;
  return (
    <a className="em" href={`${SITE_URL}/`} target="_blank" rel="noopener">
      <style dangerouslySetInnerHTML={{ __html: EM_CSS }} />
      <DeathCard
        death={card?.death ?? null}
        delta={card?.delta ?? null}
        band={card?.band ?? null}
        actions={<span>{new URL(SITE_URL).host} ↗</span>}
      >
        {card && (
          <div className="em-services">
            {names.length > 0 ? (
              <>
                <b>{names.length}</b> having issues now · {names.slice(0, MAX_NAMES).map((s) => s.name).join(', ')}
                {more > 0 && ` +${more}`}
              </>
            ) : (
              'nothing reporting issues now'
            )}
          </div>
        )}
      </DeathCard>
    </a>
  );
}

const EM_CSS = `
html, body { background: transparent !important; min-height: 0 !important; }
.em { display: block; color: inherit; text-decoration: none; }
.em .dc-card { min-width: 0; }
.em:hover .dc-card { border-color: #2a2a33; }
.em-services { margin-top: 0.85rem; padding-top: 0.7rem; border-top: 1px solid #1c1c24; font-size: 0.8rem; color: #8b8b96; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.em-services b { color: #ff4d4d; font-family: ui-monospace, monospace; }
`;
