# Doomsd.ai — Service Reliability Index

## Thesis

As AI adoption accelerates across every product category, does overall service reliability degrade? Doomsd.ai tracks this by treating internet service reliability like a market index — a single "Doomsday Index" score (0-100) representing overall SaaS ecosystem health, charted from a fixed inception date of January 1, 2026.

## Scope

The MVP is a public dashboard showing macro reliability trends. It is NOT a status page, alerting tool, or per-provider monitoring solution.

**In scope:**
- Ingest incident data from public status pages via a plugin-based provider system
- Compute a composite reliability index (per-provider, per-category, global)
- Single-page dashboard with a Doomsday Clock visualization and historical trend chart
- Category breakdowns and notable provider overlays on the trend chart

**Out of scope:**
- Real-time alerting / RSS feeds
- Per-provider detail pages
- User accounts / authentication
- Custom provider configuration by end users

## Tech Stack

- **Framework:** TanStack Start (full-stack TypeScript, SSR, file-based routing)
- **Database:** PostgreSQL + Drizzle ORM
- **Frontend:** React, SVG for the clock, charting library (TBD — Recharts or similar)
- **Cron:** External trigger (cron-job.org, systemd timer, or platform-native cron) hitting a server function endpoint
- **Language:** TypeScript throughout

## Architecture

Single TanStack Start application. One repo, one deployable unit. The daily cron job runs as a server function triggered by an external scheduler.

```
src/
  app/                  # TanStack Start routes and pages
    routes/
      index.tsx         # Main dashboard page
      api/
        cron.ts         # Daily cron endpoint
  providers/            # Status page provider plugins
    types.ts            # Provider interface
    atlassian.ts        # Atlassian Statuspage implementation
    registry.ts         # Provider registry
  index/                # Score calculation
    scoring.ts          # Per-provider scoring
    aggregation.ts      # Category and global index calculation
  db/
    schema.ts           # Drizzle schema
    client.ts           # Database connection
  components/
    DoomsdayClock.tsx   # SVG clock visualization
    TrendChart.tsx      # Historical line chart
    CategoryToggle.tsx  # Category filter controls
```

### Data Flow

Daily cron job (triggered once per day):

1. **Fetch** — iterate all providers in registry, call each plugin's `fetchIncidents()` to get recent incidents
2. **Backfill** — on first run per provider, pull historical incidents back to January 1, 2026
3. **Dedup** — upsert incidents by external ID (idempotent re-fetching)
4. **Score** — compute 7-day rolling reliability scores per provider, aggregate into category and global index
5. **Store** — write to `daily_scores` and `daily_index` tables

## Data Model

### `providers`

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| name | text | Display name (e.g., "Cloudflare") |
| slug | text unique | URL-safe identifier |
| category | text | One of: cloud-infra, ai, fintech, dev-tools, productivity, comms |
| status_page_url | text | Public status page URL |
| provider_type | text | Plugin type: "atlassian", "aws", "google", "custom" |
| created_at | timestamp | |

### `incidents`

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| provider_id | FK → providers | |
| external_id | text | Dedup key from source (unique per provider) |
| title | text | Incident title |
| severity | text | "minor", "major", or "critical" |
| started_at | timestamp | When the incident began |
| resolved_at | timestamp | Null if ongoing |
| raw | jsonb | Original payload from source |
| created_at | timestamp | |

Unique constraint on `(provider_id, external_id)` for upsert.

### `daily_scores`

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| provider_id | FK → providers | |
| date | date | |
| score | numeric | 0-100 reliability score (7-day rolling) |

Unique constraint on `(provider_id, date)`.

### `daily_index`

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| date | date unique | |
| global_score | numeric | 0-100 aggregate index |
| category_scores | jsonb | `{ "cloud-infra": 92.3, "ai": 87.1, ... }` |

## Provider Plugin System

### Interface

```typescript
interface StatusProvider {
  type: string;
  fetchIncidents(since: Date): Promise<ProviderIncident[]>;
}

interface ProviderIncident {
  externalId: string;
  title: string;
  severity: "minor" | "major" | "critical";
  startedAt: Date;
  resolvedAt: Date | null;
  raw: Record<string, unknown>;
}
```

### Atlassian Statuspage Implementation

The Atlassian Statuspage API is the first and primary plugin. It covers a large portion of the SaaS landscape because Atlassian Statuspage is a hosted product that hundreds of companies use to run their public status pages.

- **Endpoint:** `https://{status_page_url}/api/v2/incidents.json`
- **Severity mapping:** Atlassian impact levels → our severity:
  - `none` / `minor` → "minor"
  - `major` → "major"
  - `critical` → "critical"
- **Pagination:** The API returns incidents in reverse chronological order. For backfill, paginate until we reach January 1, 2026.
- **History:** Most Atlassian Statuspage instances retain full incident history, making backfill reliable.

### Initial Provider List

A broad set across categories to make the index meaningful from day one:

- **Cloud Infra:** Cloudflare, DigitalOcean, Heroku, Fastly, Vercel
- **AI:** OpenAI, Anthropic (Claude), Hugging Face
- **Dev Tools:** GitHub, GitLab, Atlassian (Jira/Confluence), CircleCI, Datadog
- **Productivity:** Notion, Figma, Canva, Zoom
- **Comms:** Twilio, SendGrid, Discord, Slack
- **Fintech:** Stripe, Plaid, Square

This list is seeded in the database. Adding a provider is a config change (add a row to `providers`), not a code change, as long as it uses a supported plugin type.

## Score Calculation

### Per-Provider Daily Score

Computed as a **7-day rolling window** of reliability:

1. Gather all incidents for this provider that overlap with the trailing 7 days
2. For each day in the window, start at 100 and deduct based on incident severity and duration:
   - **Minor:** 5 points per hour of impact
   - **Major:** 15 points per hour
   - **Critical:** 30 points per hour
3. Floor each day at 0
4. The provider's daily score = average of the 7 single-day scores

This means a major outage drags the score down for a week, then naturally rolls off. No manual resets needed.

### Category Score

Average of all provider scores within that category. Equal weight per provider.

### Global Index

Average of all category scores. Equal weight per category. This prevents categories with many providers (e.g., dev-tools) from dominating the index.

The global index is the number that drives the Doomsday Clock.

### Clock Mapping

- Index 100 = noon (12:00) — "everything is fine"
- Index 0 = midnight (00:00) — "the internet is dead"
- Linear mapping: `minutesToMidnight = 12 × (score / 100)`, so:
  - Index 100 → 12 minutes to midnight (noon)
  - Index 75 → 9 minutes to midnight
  - Index 50 → 6 minutes to midnight
  - Index 25 → 3 minutes to midnight
  - Index 0 → 0 minutes to midnight
- Headline reads: **"X MINUTES TO MIDNIGHT"**

## Frontend

### Single Page Dashboard

One page with three sections:

**1. Hero: Doomsday Clock**
- SVG clock face with a single hand
- Dark background, glowing hand color shifts from green (near noon) to red (near midnight)
- Large text: "X MINUTES TO MIDNIGHT"
- Subtext: current index score, delta from last week
- Classic aesthetic inspired by the Bulletin of the Atomic Scientists' Doomsday Clock

**2. Trend Chart**
- Line chart from January 1, 2026 to today
- Default view: global index line
- Toggle overlays: category lines (cloud-infra, ai, fintech, etc.)
- Highlight specific notable providers on the chart (Cloudflare, Shopify, Claude, Netflix, etc.)
- Hover for daily values

**3. Category Breakdown**
- Simple grid or list showing current score per category
- Visual indicator (color/icon) for trend direction (improving/degrading)

### No Additional Pages

No provider detail pages, about pages, or settings. One page, one story.

## Deployment Considerations

- PostgreSQL hosted instance (Neon, Supabase, or Railway)
- TanStack Start app deployed to any Node.js hosting (Railway, Fly.io, VPS)
- Daily cron trigger via external service or platform-native scheduler
- Cron endpoint should be protected with a simple secret token in the URL or header to prevent unauthorized triggers
