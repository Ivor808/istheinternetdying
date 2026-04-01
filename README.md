# is the internet dying?

**The Death Index** — tracking the slow heat death of the internet, one status page at a time.

A composite reliability score (0–100) for 50+ major SaaS providers, updated daily. As AI adoption accelerates across every product category, does overall service reliability degrade? The Death Index tracks the answer.

**Live at [istheinternetdying.com](https://istheinternetdying.com)**

## What it does

- Ingests incident data from public Atlassian Statuspage APIs across 50+ providers
- Computes per-provider reliability scores using a severity envelope model (7-day rolling window)
- Aggregates into category scores and a single global Death Index
- Visualizes the trend with a Doomsday Clock, historical chart, CVE overlay, and AI event markers
- Tracks CVE publication rates from the NVD to correlate vulnerability trends with reliability

## Tech stack

- **Framework:** TanStack Start (React, SSR)
- **Database:** PostgreSQL + Drizzle ORM
- **Charts:** Recharts
- **Hosting:** Railway
- **Tests:** Vitest

## Local development

```bash
# Prerequisites: Node 22+, Docker (for Supabase)

# Clone and install
git clone https://github.com/Ivor808/istheinternetdying.git
cd istheinternetdying
npm install

# Start local database
./doom up
./doom migrate

# Start dev server
./doom dev

# Trigger initial data sync (in another terminal)
./doom sync

# Run tests
npm test
```

### Doom CLI

| Command | Description |
|---------|-------------|
| `./doom up` | Start local Supabase |
| `./doom down` | Stop local Supabase |
| `./doom migrate` | Run database migrations |
| `./doom wipe` | Drop all tables and re-migrate |
| `./doom sync` | Trigger daily data sync |
| `./doom dev` | Start dev server |
| `./doom status` | Show Supabase status |
| `./doom db` | Open psql shell |

## Contributing

Contributions welcome! Here are the areas where help is most needed:

### Add more providers

We currently track 50+ providers that use Atlassian Statuspage. To add a new one:

1. Verify the provider has a public Atlassian Statuspage (`{url}/api/v2/incidents.json` returns JSON)
2. Add an entry to `src/providers/config.ts`
3. Open a PR

Providers that use custom status pages (AWS, Slack, Stripe, etc.) need custom parsers — see `src/providers/types.ts` for the interface.

### Improve historical data

Some providers have limited history on their status pages. If you know of alternative public data sources for incident history, open an issue.

### Add data sources

- **CVE data:** We pull from the NVD API. Additional sources (EPSS exploit probability, vendor-specific advisories) would enrich the vulnerability overlay.
- **Custom status page parsers:** Slack, Stripe, GitLab, and others use custom status pages we can't yet ingest. Each needs a parser implementing the `StatusProvider` interface.
- **Downtime aggregators:** If you know of free, ToS-compliant APIs for historical outage data, let us know.

### Improve scoring methodology

The scoring model is documented at [istheinternetdying.com/methodology](https://istheinternetdying.com/methodology). Key areas for discussion:

- **Severity envelope tuning** — are the points-per-hour deductions (5/15/30) well-calibrated?
- **Duration caps** — we cap scoring impact at 3/5/7 days by severity. Should these be different?
- **Category weighting** — currently equal weight per category. Should some categories matter more?
- **CVE integration** — should vulnerability data factor into the Death Index score itself?

Open an issue to discuss before submitting scoring changes.

### Fix bugs / improve UI

Check [open issues](https://github.com/Ivor808/istheinternetdying/issues) or submit new ones.

## Project structure

```
app/
  routes/           # Pages (index, methodology, API endpoints)
  components/       # React components (clock, chart, table, etc.)
src/
  providers/        # Status page provider plugins
  scoring/          # Score calculation (envelope model, aggregation)
  cron/             # Daily sync orchestrator + CVE fetcher
  data/             # Dashboard queries, AI event data
  db/               # Drizzle schema and client
```

## License

AGPL-3.0 — see [LICENSE](LICENSE)
