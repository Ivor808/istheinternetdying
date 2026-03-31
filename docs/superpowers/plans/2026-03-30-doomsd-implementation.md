# Doomsd.ai Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public dashboard that tracks SaaS service reliability as a composite index, visualized as a Doomsday Clock.

**Architecture:** Single TanStack Start app with PostgreSQL + Drizzle ORM. A daily cron endpoint fetches incident data from provider status pages via a plugin system, computes a 7-day rolling reliability index, and stores daily scores. The frontend renders a single page with an SVG Doomsday Clock and a historical trend chart.

**Tech Stack:** TanStack Start, React, TypeScript, PostgreSQL, Drizzle ORM, Recharts, Vitest

---

## File Structure

```
doomsd/
├── app/
│   ├── client.tsx                  # Client entry
│   ├── router.tsx                  # Router config
│   ├── ssr.tsx                     # SSR entry
│   ├── routes/
│   │   ├── __root.tsx              # Root layout (dark theme, fonts)
│   │   ├── index.tsx               # Dashboard page
│   │   └── api/
│   │       └── cron.ts             # Daily cron endpoint
│   └── components/
│       ├── DoomsdayClock.tsx        # SVG clock visualization
│       ├── TrendChart.tsx           # Historical line chart
│       └── CategoryBreakdown.tsx    # Category score grid
├── src/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema
│   │   └── client.ts               # Database connection
│   ├── providers/
│   │   ├── types.ts                # Provider plugin interface
│   │   ├── config.ts               # Provider list (source of truth)
│   │   ├── atlassian.ts            # Atlassian Statuspage plugin
│   │   └── registry.ts             # Plugin registry
│   ├── scoring/
│   │   ├── provider-score.ts       # Per-provider 7-day rolling score
│   │   └── aggregation.ts          # Category + global index
│   ├── cron/
│   │   └── daily-sync.ts           # Orchestrates fetch → dedup → score → store
│   └── data/
│       └── dashboard.ts            # Dashboard data queries
├── tests/
│   ├── scoring/
│   │   ├── provider-score.test.ts
│   │   └── aggregation.test.ts
│   ├── providers/
│   │   └── atlassian.test.ts
│   └── cron/
│       └── daily-sync.test.ts
├── drizzle/                         # Generated migrations
├── app.config.ts
├── drizzle.config.ts
├── tsconfig.json
├── package.json
├── .env
└── .gitignore
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `app.config.ts`, `tsconfig.json`, `.gitignore`, `.env`, `drizzle.config.ts`
- Create: `app/client.tsx`, `app/router.tsx`, `app/ssr.tsx`, `app/routes/__root.tsx`, `app/routes/index.tsx`

- [ ] **Step 1: Initialize TanStack Start project**

```bash
npm create @tanstack/app@latest -- --template start-basic
```

When prompted, name the project `.` (current directory) or move files. Select defaults. This scaffolds the basic structure with `app/`, `app.config.ts`, `tsconfig.json`, etc.

- [ ] **Step 2: Install dependencies**

```bash
npm install drizzle-orm pg recharts dotenv
npm install -D drizzle-kit @types/pg vitest @vitest/coverage-v8
```

- [ ] **Step 3: Create `.env` file**

```bash
# .env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/doomsd"
CRON_SECRET="change-me-in-production"
```

- [ ] **Step 4: Create `drizzle.config.ts`**

```typescript
// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Add vitest config to `app.config.ts`**

Add a `vitest.config.ts`:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 6: Update `.gitignore`**

Append to the generated `.gitignore`:

```
.env
.superpowers/
```

- [ ] **Step 7: Add scripts to `package.json`**

Add to the `"scripts"` section:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Dev server starts on `http://localhost:3000` with the default TanStack Start page.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold TanStack Start project with Drizzle and Vitest"
```

---

## Task 2: Database Schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`

- [ ] **Step 1: Create the Drizzle schema**

```typescript
// src/db/schema.ts
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  date,
  unique,
} from 'drizzle-orm/pg-core';

export const providers = pgTable('providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull(),
  statusPageUrl: text('status_page_url').notNull(),
  providerType: text('provider_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const incidents = pgTable(
  'incidents',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id')
      .references(() => providers.id)
      .notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    severity: text('severity').notNull(),
    startedAt: timestamp('started_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('incidents_provider_external_id').on(
      table.providerId,
      table.externalId
    ),
  ]
);

export const dailyScores = pgTable(
  'daily_scores',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id')
      .references(() => providers.id)
      .notNull(),
    date: date('date').notNull(),
    score: numeric('score').notNull(),
  },
  (table) => [
    unique('daily_scores_provider_date').on(table.providerId, table.date),
  ]
);

export const dailyIndex = pgTable('daily_index', {
  id: serial('id').primaryKey(),
  date: date('date').notNull().unique(),
  globalScore: numeric('global_score').notNull(),
  categoryScores: jsonb('category_scores')
    .$type<Record<string, number>>()
    .notNull(),
});
```

- [ ] **Step 2: Create database client**

```typescript
// src/db/client.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 3: Generate and apply migration**

```bash
npx drizzle-kit generate --name=init
npx drizzle-kit migrate
```

Expected: Migration files created in `drizzle/` directory, tables created in the database.

- [ ] **Step 4: Verify tables exist**

```bash
npx drizzle-kit studio
```

Or connect via psql and check:

```bash
psql $DATABASE_URL -c "\dt"
```

Expected: `providers`, `incidents`, `daily_scores`, `daily_index` tables exist.

- [ ] **Step 5: Commit**

```bash
git add src/db/ drizzle/
git commit -m "feat: add database schema with Drizzle ORM"
```

---

## Task 3: Provider Plugin System

**Files:**
- Create: `src/providers/types.ts`, `src/providers/config.ts`, `src/providers/registry.ts`

- [ ] **Step 1: Define the provider plugin interface**

```typescript
// src/providers/types.ts
export interface ProviderIncident {
  externalId: string;
  title: string;
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
  raw: Record<string, unknown>;
}

export interface StatusProvider {
  type: string;
  fetchIncidents(
    statusPageUrl: string,
    since: Date
  ): Promise<ProviderIncident[]>;
}

export interface ProviderConfig {
  name: string;
  slug: string;
  category: string;
  providerType: string;
  statusPageUrl: string;
}
```

- [ ] **Step 2: Create the provider config list**

```typescript
// src/providers/config.ts
import type { ProviderConfig } from './types';

export const providerConfigs: ProviderConfig[] = [
  // Cloud Infra
  { name: 'Cloudflare', slug: 'cloudflare', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://www.cloudflarestatus.com' },
  { name: 'DigitalOcean', slug: 'digitalocean', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.digitalocean.com' },
  { name: 'Heroku', slug: 'heroku', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.heroku.com' },
  { name: 'Fastly', slug: 'fastly', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.fastly.com' },
  { name: 'Vercel', slug: 'vercel', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://www.vercel-status.com' },

  // AI
  { name: 'OpenAI', slug: 'openai', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.openai.com' },
  { name: 'Anthropic', slug: 'anthropic', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.anthropic.com' },
  { name: 'Hugging Face', slug: 'huggingface', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.huggingface.co' },

  // Dev Tools
  { name: 'GitHub', slug: 'github', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://www.githubstatus.com' },
  { name: 'GitLab', slug: 'gitlab', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.gitlab.com' },
  { name: 'Atlassian', slug: 'atlassian', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.atlassian.com' },
  { name: 'CircleCI', slug: 'circleci', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.circleci.com' },
  { name: 'Datadog', slug: 'datadog', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.datadoghq.com' },

  // Productivity
  { name: 'Notion', slug: 'notion', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.notion.so' },
  { name: 'Figma', slug: 'figma', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.figma.com' },
  { name: 'Canva', slug: 'canva', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://www.canvastatus.com' },
  { name: 'Zoom', slug: 'zoom', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.zoom.us' },

  // Comms
  { name: 'Twilio', slug: 'twilio', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.twilio.com' },
  { name: 'SendGrid', slug: 'sendgrid', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.sendgrid.com' },
  { name: 'Discord', slug: 'discord', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://discordstatus.com' },
  { name: 'Slack', slug: 'slack', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.slack.com' },

  // Fintech
  { name: 'Stripe', slug: 'stripe', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://status.stripe.com' },
  { name: 'Plaid', slug: 'plaid', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://status.plaid.com' },
  { name: 'Square', slug: 'square', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://issquareup.com' },
];
```

- [ ] **Step 3: Create the provider registry**

```typescript
// src/providers/registry.ts
import type { StatusProvider } from './types';

const providers = new Map<string, StatusProvider>();

export function registerProvider(provider: StatusProvider): void {
  providers.set(provider.type, provider);
}

export function getProvider(type: string): StatusProvider {
  const provider = providers.get(type);
  if (!provider) {
    throw new Error(`No provider registered for type: ${type}`);
  }
  return provider;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/providers/
git commit -m "feat: add provider plugin interface, config, and registry"
```

---

## Task 4: Atlassian Statuspage Plugin

**Files:**
- Create: `src/providers/atlassian.ts`, `tests/providers/atlassian.test.ts`

- [ ] **Step 1: Write the failing test for severity mapping**

```typescript
// tests/providers/atlassian.test.ts
import { describe, it, expect } from 'vitest';
import { mapImpactToSeverity } from '../src/providers/atlassian';

describe('atlassian provider', () => {
  describe('mapImpactToSeverity', () => {
    it('maps none to minor', () => {
      expect(mapImpactToSeverity('none')).toBe('minor');
    });

    it('maps minor to minor', () => {
      expect(mapImpactToSeverity('minor')).toBe('minor');
    });

    it('maps major to major', () => {
      expect(mapImpactToSeverity('major')).toBe('major');
    });

    it('maps critical to critical', () => {
      expect(mapImpactToSeverity('critical')).toBe('critical');
    });

    it('defaults unknown values to minor', () => {
      expect(mapImpactToSeverity('unknown')).toBe('minor');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/providers/atlassian.test.ts
```

Expected: FAIL — `mapImpactToSeverity` not found.

- [ ] **Step 3: Write failing test for incident parsing**

Add to the same test file:

```typescript
import { describe, it, expect } from 'vitest';
import { mapImpactToSeverity, parseAtlassianIncident } from '../src/providers/atlassian';

describe('parseAtlassianIncident', () => {
  it('parses a resolved incident', () => {
    const raw = {
      id: 'abc123',
      name: 'API degradation',
      impact: 'major',
      created_at: '2026-01-15T10:00:00.000Z',
      resolved_at: '2026-01-15T14:00:00.000Z',
      status: 'resolved',
    };

    const result = parseAtlassianIncident(raw);

    expect(result).toEqual({
      externalId: 'abc123',
      title: 'API degradation',
      severity: 'major',
      startedAt: new Date('2026-01-15T10:00:00.000Z'),
      resolvedAt: new Date('2026-01-15T14:00:00.000Z'),
      raw,
    });
  });

  it('parses an unresolved incident with null resolved_at', () => {
    const raw = {
      id: 'def456',
      name: 'Ongoing issue',
      impact: 'critical',
      created_at: '2026-03-30T08:00:00.000Z',
      resolved_at: null,
      status: 'investigating',
    };

    const result = parseAtlassianIncident(raw);

    expect(result.resolvedAt).toBeNull();
    expect(result.severity).toBe('critical');
  });
});
```

- [ ] **Step 4: Implement the Atlassian plugin**

```typescript
// src/providers/atlassian.ts
import type { StatusProvider, ProviderIncident } from './types';

interface AtlassianIncident {
  id: string;
  name: string;
  impact: string;
  created_at: string;
  resolved_at: string | null;
  status: string;
  [key: string]: unknown;
}

interface AtlassianResponse {
  incidents: AtlassianIncident[];
}

export function mapImpactToSeverity(
  impact: string
): 'minor' | 'major' | 'critical' {
  switch (impact) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'major';
    case 'minor':
    case 'none':
    default:
      return 'minor';
  }
}

export function parseAtlassianIncident(
  raw: AtlassianIncident
): ProviderIncident {
  return {
    externalId: raw.id,
    title: raw.name,
    severity: mapImpactToSeverity(raw.impact),
    startedAt: new Date(raw.created_at),
    resolvedAt: raw.resolved_at ? new Date(raw.resolved_at) : null,
    raw: raw as Record<string, unknown>,
  };
}

export const atlassianProvider: StatusProvider = {
  type: 'atlassian',

  async fetchIncidents(
    statusPageUrl: string,
    since: Date
  ): Promise<ProviderIncident[]> {
    const incidents: ProviderIncident[] = [];
    let page = 1;

    while (true) {
      const url = `${statusPageUrl}/api/v2/incidents.json?page=${page}&per_page=100`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`
        );
      }

      const data: AtlassianResponse = await response.json();

      if (data.incidents.length === 0) break;

      let reachedSince = false;
      for (const incident of data.incidents) {
        const createdAt = new Date(incident.created_at);
        if (createdAt < since) {
          reachedSince = true;
          break;
        }
        incidents.push(parseAtlassianIncident(incident));
      }

      if (reachedSince || data.incidents.length < 100) break;
      page++;
    }

    return incidents;
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/providers/atlassian.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Write failing test for fetchIncidents with mocked fetch**

Add to the test file:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapImpactToSeverity,
  parseAtlassianIncident,
  atlassianProvider,
} from '../src/providers/atlassian';

describe('atlassianProvider.fetchIncidents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and parses incidents from a single page', async () => {
    const mockIncidents = [
      {
        id: 'inc1',
        name: 'Outage',
        impact: 'major',
        created_at: '2026-03-01T10:00:00.000Z',
        resolved_at: '2026-03-01T12:00:00.000Z',
        status: 'resolved',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ incidents: mockIncidents }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await atlassianProvider.fetchIncidents(
      'https://status.example.com',
      new Date('2026-01-01T00:00:00.000Z')
    );

    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe('inc1');
    expect(result[0].severity).toBe('major');
    expect(fetch).toHaveBeenCalledWith(
      'https://status.example.com/api/v2/incidents.json?page=1&per_page=100'
    );
  });

  it('stops paginating when incidents are older than since date', async () => {
    const oldIncident = {
      id: 'old1',
      name: 'Old issue',
      impact: 'minor',
      created_at: '2025-06-01T10:00:00.000Z',
      resolved_at: '2025-06-01T11:00:00.000Z',
      status: 'resolved',
    };

    const newIncident = {
      id: 'new1',
      name: 'New issue',
      impact: 'minor',
      created_at: '2026-02-01T10:00:00.000Z',
      resolved_at: '2026-02-01T11:00:00.000Z',
      status: 'resolved',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ incidents: [newIncident, oldIncident] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await atlassianProvider.fetchIncidents(
      'https://status.example.com',
      new Date('2026-01-01T00:00:00.000Z')
    );

    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe('new1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/providers/atlassian.test.ts
```

Expected: All tests PASS.

- [ ] **Step 8: Register the Atlassian provider**

Update the registry to auto-register:

```typescript
// src/providers/registry.ts
import type { StatusProvider } from './types';
import { atlassianProvider } from './atlassian';

const providers = new Map<string, StatusProvider>();

export function registerProvider(provider: StatusProvider): void {
  providers.set(provider.type, provider);
}

export function getProvider(type: string): StatusProvider {
  const provider = providers.get(type);
  if (!provider) {
    throw new Error(`No provider registered for type: ${type}`);
  }
  return provider;
}

// Auto-register built-in providers
registerProvider(atlassianProvider);
```

- [ ] **Step 9: Commit**

```bash
git add src/providers/ tests/providers/
git commit -m "feat: implement Atlassian Statuspage provider plugin"
```

---

## Task 5: Score Calculation — Per-Provider

**Files:**
- Create: `src/scoring/provider-score.ts`, `tests/scoring/provider-score.test.ts`

- [ ] **Step 1: Write the failing test for single-day deduction**

```typescript
// tests/scoring/provider-score.test.ts
import { describe, it, expect } from 'vitest';
import { computeSingleDayScore } from '../src/scoring/provider-score';

describe('computeSingleDayScore', () => {
  const day = new Date('2026-03-15');

  it('returns 100 when there are no incidents', () => {
    expect(computeSingleDayScore([], day)).toBe(100);
  });

  it('deducts 5 points per hour for minor incidents', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'), // 2 hours
      },
    ];
    // 100 - (5 * 2) = 90
    expect(computeSingleDayScore(incidents, day)).toBe(90);
  });

  it('deducts 15 points per hour for major incidents', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'), // 2 hours
      },
    ];
    // 100 - (15 * 2) = 70
    expect(computeSingleDayScore(incidents, day)).toBe(70);
  });

  it('deducts 30 points per hour for critical incidents', () => {
    const incidents = [
      {
        severity: 'critical' as const,
        startedAt: new Date('2026-03-15T10:00:00Z'),
        resolvedAt: new Date('2026-03-15T12:00:00Z'), // 2 hours
      },
    ];
    // 100 - (30 * 2) = 40
    expect(computeSingleDayScore(incidents, day)).toBe(40);
  });

  it('floors at 0', () => {
    const incidents = [
      {
        severity: 'critical' as const,
        startedAt: new Date('2026-03-15T00:00:00Z'),
        resolvedAt: new Date('2026-03-15T23:59:59Z'), // ~24 hours
      },
    ];
    // 100 - (30 * 24) = -620, floored to 0
    expect(computeSingleDayScore(incidents, day)).toBe(0);
  });

  it('only counts hours that overlap with the given day', () => {
    const incidents = [
      {
        severity: 'minor' as const,
        // Starts day before, ends 2 hours into the day
        startedAt: new Date('2026-03-14T20:00:00Z'),
        resolvedAt: new Date('2026-03-15T02:00:00Z'),
      },
    ];
    // Only 2 hours overlap with March 15: midnight to 02:00
    // 100 - (5 * 2) = 90
    expect(computeSingleDayScore(incidents, day)).toBe(90);
  });

  it('treats unresolved incidents as ongoing until end of day', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-15T20:00:00Z'),
        resolvedAt: null,
      },
    ];
    // 4 hours from 20:00 to midnight
    // 100 - (15 * 4) = 40
    expect(computeSingleDayScore(incidents, day)).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/scoring/provider-score.test.ts
```

Expected: FAIL — `computeSingleDayScore` not found.

- [ ] **Step 3: Implement `computeSingleDayScore`**

```typescript
// src/scoring/provider-score.ts

interface IncidentWindow {
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt: Date | null;
}

const SEVERITY_POINTS_PER_HOUR: Record<string, number> = {
  minor: 5,
  major: 15,
  critical: 30,
};

export function computeSingleDayScore(
  incidents: IncidentWindow[],
  day: Date
): number {
  const dayStart = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  let deduction = 0;

  for (const incident of incidents) {
    const incStart = incident.startedAt;
    const incEnd = incident.resolvedAt ?? dayEnd;

    const overlapStart = new Date(Math.max(incStart.getTime(), dayStart.getTime()));
    const overlapEnd = new Date(Math.min(incEnd.getTime(), dayEnd.getTime()));

    if (overlapStart >= overlapEnd) continue;

    const overlapHours =
      (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
    const pointsPerHour = SEVERITY_POINTS_PER_HOUR[incident.severity] ?? 0;
    deduction += pointsPerHour * overlapHours;
  }

  return Math.max(0, Math.round(100 - deduction));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scoring/provider-score.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Write failing test for 7-day rolling score**

Add to the test file:

```typescript
import { computeSingleDayScore, computeRollingScore } from '../src/scoring/provider-score';

describe('computeRollingScore', () => {
  it('averages 7 days of scores', () => {
    // No incidents over 7 days = 100
    const result = computeRollingScore([], new Date('2026-03-15'));
    expect(result).toBe(100);
  });

  it('reflects a single incident across the window', () => {
    const incidents = [
      {
        severity: 'major' as const,
        startedAt: new Date('2026-03-12T10:00:00Z'),
        resolvedAt: new Date('2026-03-12T14:00:00Z'), // 4 hours on March 12
      },
    ];
    // March 12: 100 - (15 * 4) = 40
    // March 9-11, 13-15: 100 each (6 days)
    // Average: (40 + 6*100) / 7 = 640/7 ≈ 91.43, rounded to 91
    const result = computeRollingScore(incidents, new Date('2026-03-15'));
    expect(result).toBe(91);
  });
});
```

- [ ] **Step 6: Implement `computeRollingScore`**

Add to `src/scoring/provider-score.ts`:

```typescript
export function computeRollingScore(
  incidents: IncidentWindow[],
  date: Date
): number {
  let total = 0;

  for (let i = 6; i >= 0; i--) {
    const day = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - i)
    );
    total += computeSingleDayScore(incidents, day);
  }

  return Math.round(total / 7);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/scoring/provider-score.test.ts
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/scoring/ tests/scoring/
git commit -m "feat: implement per-provider scoring with 7-day rolling window"
```

---

## Task 6: Score Calculation — Aggregation

**Files:**
- Create: `src/scoring/aggregation.ts`, `tests/scoring/aggregation.test.ts`

- [ ] **Step 1: Write the failing test for category and global aggregation**

```typescript
// tests/scoring/aggregation.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeCategoryScores,
  computeGlobalIndex,
} from '../src/scoring/aggregation';

describe('computeCategoryScores', () => {
  it('averages scores within each category', () => {
    const providerScores = [
      { category: 'cloud-infra', score: 90 },
      { category: 'cloud-infra', score: 80 },
      { category: 'ai', score: 70 },
      { category: 'ai', score: 100 },
    ];

    const result = computeCategoryScores(providerScores);

    expect(result['cloud-infra']).toBe(85);
    expect(result['ai']).toBe(85);
  });

  it('handles a single provider in a category', () => {
    const providerScores = [{ category: 'fintech', score: 95 }];

    const result = computeCategoryScores(providerScores);

    expect(result['fintech']).toBe(95);
  });
});

describe('computeGlobalIndex', () => {
  it('averages category scores with equal weight', () => {
    const categoryScores = {
      'cloud-infra': 90,
      ai: 80,
      fintech: 100,
    };

    // (90 + 80 + 100) / 3 = 90
    const result = computeGlobalIndex(categoryScores);
    expect(result).toBe(90);
  });

  it('rounds to nearest integer', () => {
    const categoryScores = {
      'cloud-infra': 91,
      ai: 82,
    };

    // (91 + 82) / 2 = 86.5, rounds to 87
    const result = computeGlobalIndex(categoryScores);
    expect(result).toBe(87);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/scoring/aggregation.test.ts
```

Expected: FAIL — functions not found.

- [ ] **Step 3: Implement aggregation**

```typescript
// src/scoring/aggregation.ts

interface ProviderScore {
  category: string;
  score: number;
}

export function computeCategoryScores(
  providerScores: ProviderScore[]
): Record<string, number> {
  const categoryGroups = new Map<string, number[]>();

  for (const { category, score } of providerScores) {
    const scores = categoryGroups.get(category) ?? [];
    scores.push(score);
    categoryGroups.set(category, scores);
  }

  const result: Record<string, number> = {};
  for (const [category, scores] of categoryGroups) {
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    result[category] = Math.round(avg);
  }

  return result;
}

export function computeGlobalIndex(
  categoryScores: Record<string, number>
): number {
  const values = Object.values(categoryScores);
  if (values.length === 0) return 100;
  const avg = values.reduce((sum, s) => sum + s, 0) / values.length;
  return Math.round(avg);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scoring/aggregation.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/aggregation.ts tests/scoring/aggregation.test.ts
git commit -m "feat: implement category and global index aggregation"
```

---

## Task 7: Daily Sync Orchestrator

**Files:**
- Create: `src/cron/daily-sync.ts`, `tests/cron/daily-sync.test.ts`

- [ ] **Step 1: Write the failing test for the sync orchestrator**

```typescript
// tests/cron/daily-sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDailySync } from '../src/cron/daily-sync';

// Mock the database and providers
vi.mock('../src/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../src/providers/registry', () => ({
  getProvider: vi.fn(),
}));

describe('runDailySync', () => {
  it('is a function that returns a promise', () => {
    expect(typeof runDailySync).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/cron/daily-sync.test.ts
```

Expected: FAIL — `runDailySync` not found.

- [ ] **Step 3: Implement the daily sync orchestrator**

```typescript
// src/cron/daily-sync.ts
import { db } from '../db/client';
import { providers, incidents, dailyScores, dailyIndex } from '../db/schema';
import { providerConfigs } from '../providers/config';
import { getProvider } from '../providers/registry';
import { computeRollingScore } from '../scoring/provider-score';
import {
  computeCategoryScores,
  computeGlobalIndex,
} from '../scoring/aggregation';
import { eq, and, sql, gte } from 'drizzle-orm';

const INCEPTION_DATE = new Date('2026-01-01T00:00:00Z');

export async function syncProviders(): Promise<void> {
  for (const config of providerConfigs) {
    await db
      .insert(providers)
      .values({
        name: config.name,
        slug: config.slug,
        category: config.category,
        statusPageUrl: config.statusPageUrl,
        providerType: config.providerType,
      })
      .onConflictDoUpdate({
        target: providers.slug,
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          statusPageUrl: sql`excluded.status_page_url`,
          providerType: sql`excluded.provider_type`,
        },
      });
  }
}

export async function fetchAndStoreIncidents(): Promise<void> {
  const allProviders = await db.select().from(providers);

  for (const provider of allProviders) {
    const plugin = getProvider(provider.providerType);

    // Check if we have any incidents for this provider
    const existing = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(eq(incidents.providerId, provider.id))
      .limit(1);

    const since = existing.length === 0 ? INCEPTION_DATE : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const fetched = await plugin.fetchIncidents(
      provider.statusPageUrl,
      since
    );

    for (const incident of fetched) {
      await db
        .insert(incidents)
        .values({
          providerId: provider.id,
          externalId: incident.externalId,
          title: incident.title,
          severity: incident.severity,
          startedAt: incident.startedAt,
          resolvedAt: incident.resolvedAt,
          raw: incident.raw,
        })
        .onConflictDoUpdate({
          target: [incidents.providerId, incidents.externalId],
          set: {
            title: sql`excluded.title`,
            severity: sql`excluded.severity`,
            resolvedAt: sql`excluded.resolved_at`,
            raw: sql`excluded.raw`,
          },
        });
    }
  }
}

export async function computeAndStoreScores(
  date: Date
): Promise<{ globalScore: number; categoryScores: Record<string, number> }> {
  const allProviders = await db.select().from(providers);
  const sevenDaysAgo = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);

  const providerScoreEntries: { category: string; score: number }[] = [];

  for (const provider of allProviders) {
    const providerIncidents = await db
      .select({
        severity: incidents.severity,
        startedAt: incidents.startedAt,
        resolvedAt: incidents.resolvedAt,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.providerId, provider.id),
          gte(incidents.startedAt, sevenDaysAgo)
        )
      );

    const incidentWindows = providerIncidents.map((inc) => ({
      severity: inc.severity as 'minor' | 'major' | 'critical',
      startedAt: inc.startedAt,
      resolvedAt: inc.resolvedAt,
    }));

    const score = computeRollingScore(incidentWindows, date);

    const dateStr = date.toISOString().split('T')[0];
    await db
      .insert(dailyScores)
      .values({
        providerId: provider.id,
        date: dateStr,
        score: String(score),
      })
      .onConflictDoUpdate({
        target: [dailyScores.providerId, dailyScores.date],
        set: { score: sql`excluded.score` },
      });

    providerScoreEntries.push({ category: provider.category, score });
  }

  const catScores = computeCategoryScores(providerScoreEntries);
  const global = computeGlobalIndex(catScores);

  const dateStr = date.toISOString().split('T')[0];
  await db
    .insert(dailyIndex)
    .values({
      date: dateStr,
      globalScore: String(global),
      categoryScores: catScores,
    })
    .onConflictDoUpdate({
      target: dailyIndex.date,
      set: {
        globalScore: sql`excluded.global_score`,
        categoryScores: sql`excluded.category_scores`,
      },
    });

  return { globalScore: global, categoryScores: catScores };
}

export async function runDailySync(): Promise<{
  globalScore: number;
  categoryScores: Record<string, number>;
}> {
  await syncProviders();
  await fetchAndStoreIncidents();
  const result = await computeAndStoreScores(new Date());
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/cron/daily-sync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cron/ tests/cron/
git commit -m "feat: implement daily sync orchestrator"
```

---

## Task 8: Cron API Endpoint

**Files:**
- Create: `app/routes/api/cron.ts`

- [ ] **Step 1: Create the cron API route**

```typescript
// app/routes/api/cron.ts
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { runDailySync } from '../../src/cron/daily-sync';

export const APIRoute = createAPIFileRoute('/api/cron')({
  POST: async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await runDailySync();

    return new Response(
      JSON.stringify({
        success: true,
        globalScore: result.globalScore,
        categoryScores: result.categoryScores,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
});
```

- [ ] **Step 2: Verify the route loads**

```bash
npm run dev
```

Then test:

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "Authorization: Bearer change-me-in-production" \
  -H "Content-Type: application/json"
```

Expected: Either a success response (if DB is running) or a connection error (which confirms the route itself works).

- [ ] **Step 3: Commit**

```bash
git add app/routes/api/
git commit -m "feat: add cron API endpoint with auth"
```

---

## Task 9: Dashboard Data Loading

**Files:**
- Create: `app/routes/index.tsx` (modify the scaffolded one)

- [ ] **Step 1: Create server functions for dashboard data**

```typescript
// src/data/dashboard.ts
import { db } from '../db/client';
import { dailyIndex, dailyScores, providers } from '../db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export interface DashboardData {
  current: {
    globalScore: number;
    categoryScores: Record<string, number>;
    date: string;
  } | null;
  previous: {
    globalScore: number;
    date: string;
  } | null;
  history: Array<{
    date: string;
    globalScore: number;
    categoryScores: Record<string, number>;
  }>;
  providerHistory: Array<{
    date: string;
    slug: string;
    name: string;
    score: number;
  }>;
}

const NOTABLE_PROVIDERS = [
  'cloudflare',
  'github',
  'openai',
  'anthropic',
  'stripe',
  'discord',
];

export async function getDashboardData(): Promise<DashboardData> {
  // Current index
  const [current] = await db
    .select()
    .from(dailyIndex)
    .orderBy(desc(dailyIndex.date))
    .limit(1);

  // Previous week index (for delta)
  const [previous] = await db
    .select()
    .from(dailyIndex)
    .orderBy(desc(dailyIndex.date))
    .limit(1)
    .offset(7);

  // Full history
  const history = await db
    .select({
      date: dailyIndex.date,
      globalScore: dailyIndex.globalScore,
      categoryScores: dailyIndex.categoryScores,
    })
    .from(dailyIndex)
    .orderBy(dailyIndex.date);

  // Notable provider daily scores
  const notableProviders = await db
    .select({ id: providers.id, slug: providers.slug, name: providers.name })
    .from(providers)
    .where(
      sql`${providers.slug} = ANY(${NOTABLE_PROVIDERS})`
    );

  let providerHistory: DashboardData['providerHistory'] = [];
  for (const p of notableProviders) {
    const scores = await db
      .select({ date: dailyScores.date, score: dailyScores.score })
      .from(dailyScores)
      .where(eq(dailyScores.providerId, p.id))
      .orderBy(dailyScores.date);

    for (const s of scores) {
      providerHistory.push({
        date: s.date,
        slug: p.slug,
        name: p.name,
        score: Number(s.score),
      });
    }
  }

  return {
    current: current
      ? {
          globalScore: Number(current.globalScore),
          categoryScores: current.categoryScores,
          date: current.date,
        }
      : null,
    previous: previous
      ? {
          globalScore: Number(previous.globalScore),
          date: previous.date,
        }
      : null,
    history: history.map((h) => ({
      date: h.date,
      globalScore: Number(h.globalScore),
      categoryScores: h.categoryScores,
    })),
    providerHistory,
  };
}
```

- [ ] **Step 2: Create the dashboard route with loader**

```typescript
// app/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getDashboardData } from '../src/data/dashboard';
import { DoomsdayClock } from '../app/components/DoomsdayClock';
import { TrendChart } from '../app/components/TrendChart';
import { CategoryBreakdown } from '../app/components/CategoryBreakdown';

const loadDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  return getDashboardData();
});

export const Route = createFileRoute('/')({
  loader: () => loadDashboard(),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();

  return (
    <div className="dashboard">
      <DoomsdayClock
        globalScore={data.current?.globalScore ?? 100}
        previousScore={data.previous?.globalScore ?? null}
      />
      <TrendChart
        history={data.history}
        providerHistory={data.providerHistory}
      />
      {data.current && (
        <CategoryBreakdown
          categoryScores={data.current.categoryScores}
          previousCategoryScores={
            data.previous
              ? data.history.find((h) => h.date === data.previous!.date)
                  ?.categoryScores ?? null
              : null
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/ app/routes/index.tsx
git commit -m "feat: add dashboard data loading with server functions"
```

---

## Task 10: Doomsday Clock Component

**Files:**
- Create: `app/components/DoomsdayClock.tsx`

- [ ] **Step 1: Create the clock component**

```tsx
// app/components/DoomsdayClock.tsx

interface DoomsdayClockProps {
  globalScore: number;
  previousScore: number | null;
}

export function DoomsdayClock({ globalScore, previousScore }: DoomsdayClockProps) {
  const minutesToMidnight = 12 * (globalScore / 100);
  const displayMinutes = Math.round(minutesToMidnight * 10) / 10;

  // Clock hand angle: noon (score=100) = 180deg, midnight (score=0) = 360deg/0deg
  // We map score 100 -> 180deg (pointing down/noon), score 0 -> 360deg (pointing up/midnight)
  const handAngle = 180 + (1 - globalScore / 100) * 180;

  // Color: green at noon, red at midnight
  const urgency = 1 - globalScore / 100;
  const r = Math.round(urgency * 255);
  const g = Math.round((1 - urgency) * 180);
  const handColor = `rgb(${r}, ${g}, 50)`;

  const delta = previousScore !== null ? globalScore - previousScore : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1rem',
      }}
    >
      <svg viewBox="0 0 200 200" width="300" height="300">
        {/* Clock face */}
        <circle cx="100" cy="100" r="95" fill="none" stroke="#333" strokeWidth="2" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#222" strokeWidth="1" />

        {/* Hour markers */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 100 + 80 * Math.sin(angle);
          const y1 = 100 - 80 * Math.cos(angle);
          const x2 = 100 + 88 * Math.sin(angle);
          const y2 = 100 - 88 * Math.cos(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#555"
              strokeWidth={i === 0 ? 3 : 1.5}
            />
          );
        })}

        {/* MIDNIGHT label */}
        <text x="100" y="30" textAnchor="middle" fill="#ff4444" fontSize="9" fontWeight="bold">
          MIDNIGHT
        </text>

        {/* Clock hand */}
        <line
          x1="100"
          y1="100"
          x2={100 + 70 * Math.sin((handAngle * Math.PI) / 180)}
          y2={100 - 70 * Math.cos((handAngle * Math.PI) / 180)}
          stroke={handColor}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill={handColor} />

        {/* Glow at tip */}
        <circle
          cx={100 + 70 * Math.sin((handAngle * Math.PI) / 180)}
          cy={100 - 70 * Math.cos((handAngle * Math.PI) / 180)}
          r="3"
          fill={handColor}
          opacity="0.6"
        />
      </svg>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <div
          style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: handColor,
            letterSpacing: '0.15em',
            fontFamily: 'monospace',
          }}
        >
          {displayMinutes} MINUTES TO MIDNIGHT
        </div>
        <div style={{ fontSize: '1rem', color: '#888', marginTop: '0.5rem' }}>
          Doomsday Index: {globalScore}
        </div>
        {delta !== null && (
          <div
            style={{
              fontSize: '0.85rem',
              color: delta >= 0 ? '#4a4' : '#f44',
              marginTop: '0.25rem',
            }}
          >
            {delta >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(delta)} from last week
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders in the browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Even without data, the clock should render with the default score of 100 (hand at noon).

- [ ] **Step 3: Commit**

```bash
git add app/components/DoomsdayClock.tsx
git commit -m "feat: add Doomsday Clock SVG component"
```

---

## Task 11: Trend Chart Component

**Files:**
- Create: `app/components/TrendChart.tsx`

- [ ] **Step 1: Create the trend chart component**

```tsx
// app/components/TrendChart.tsx
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface HistoryEntry {
  date: string;
  globalScore: number;
  categoryScores: Record<string, number>;
}

interface ProviderHistoryEntry {
  date: string;
  slug: string;
  name: string;
  score: number;
}

interface TrendChartProps {
  history: HistoryEntry[];
  providerHistory: ProviderHistoryEntry[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'cloud-infra': '#3b82f6',
  ai: '#a855f7',
  'dev-tools': '#22c55e',
  productivity: '#eab308',
  comms: '#f97316',
  fintech: '#06b6d4',
};

const PROVIDER_COLORS: Record<string, string> = {
  cloudflare: '#f48120',
  github: '#8b5cf6',
  openai: '#10a37f',
  anthropic: '#d4a574',
  stripe: '#635bff',
  discord: '#5865f2',
};

export function TrendChart({ history, providerHistory }: TrendChartProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set()
  );
  const [activeProviders, setActiveProviders] = useState<Set<string>>(
    new Set()
  );

  const allCategories = Array.from(
    new Set(history.flatMap((h) => Object.keys(h.categoryScores)))
  );
  const allProviders = Array.from(
    new Set(providerHistory.map((p) => p.slug))
  );
  const providerNames = Object.fromEntries(
    providerHistory.map((p) => [p.slug, p.name])
  );

  // Build chart data: merge global, category, and provider scores by date
  const chartData = history.map((h) => {
    const entry: Record<string, number | string> = {
      date: h.date,
      global: h.globalScore,
    };

    for (const cat of activeCategories) {
      if (h.categoryScores[cat] !== undefined) {
        entry[cat] = h.categoryScores[cat];
      }
    }

    for (const slug of activeProviders) {
      const provEntry = providerHistory.find(
        (p) => p.date === h.date && p.slug === slug
      );
      if (provEntry) {
        entry[slug] = provEntry.score;
      }
    }

    return entry;
  });

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleProvider = (slug: string) => {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '1rem' }}>
        Reliability Index — Jan 1, 2026 to Present
      </h2>

      {/* Toggle buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              border: `1px solid ${CATEGORY_COLORS[cat] ?? '#666'}`,
              background: activeCategories.has(cat)
                ? CATEGORY_COLORS[cat] ?? '#666'
                : 'transparent',
              color: activeCategories.has(cat) ? '#fff' : CATEGORY_COLORS[cat] ?? '#666',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {cat}
          </button>
        ))}
        <span style={{ color: '#555', padding: '0.25rem 0' }}>|</span>
        {allProviders.map((slug) => (
          <button
            key={slug}
            onClick={() => toggleProvider(slug)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              border: `1px solid ${PROVIDER_COLORS[slug] ?? '#666'}`,
              background: activeProviders.has(slug)
                ? PROVIDER_COLORS[slug] ?? '#666'
                : 'transparent',
              color: activeProviders.has(slug) ? '#fff' : PROVIDER_COLORS[slug] ?? '#666',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {providerNames[slug] ?? slug}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} stroke="#666" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}
          />
          <Line
            type="monotone"
            dataKey="global"
            stroke="#e0e0e0"
            strokeWidth={2}
            dot={false}
            name="Global Index"
          />
          {Array.from(activeCategories).map((cat) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={CATEGORY_COLORS[cat] ?? '#666'}
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              name={cat}
            />
          ))}
          {Array.from(activeProviders).map((slug) => (
            <Line
              key={slug}
              type="monotone"
              dataKey={slug}
              stroke={PROVIDER_COLORS[slug] ?? '#666'}
              strokeWidth={1.5}
              dot={false}
              name={providerNames[slug] ?? slug}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. The chart should render (empty if no data yet) with toggle buttons.

- [ ] **Step 3: Commit**

```bash
git add app/components/TrendChart.tsx
git commit -m "feat: add trend chart component with category and provider toggles"
```

---

## Task 12: Category Breakdown Component

**Files:**
- Create: `app/components/CategoryBreakdown.tsx`

- [ ] **Step 1: Create the category breakdown component**

```tsx
// app/components/CategoryBreakdown.tsx

interface CategoryBreakdownProps {
  categoryScores: Record<string, number>;
  previousCategoryScores: Record<string, number> | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  'cloud-infra': 'Cloud Infrastructure',
  ai: 'AI Services',
  'dev-tools': 'Developer Tools',
  productivity: 'Productivity',
  comms: 'Communications',
  fintech: 'Fintech',
};

function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e';
  if (score >= 85) return '#eab308';
  if (score >= 70) return '#f97316';
  return '#ef4444';
}

export function CategoryBreakdown({
  categoryScores,
  previousCategoryScores,
}: CategoryBreakdownProps) {
  const categories = Object.entries(categoryScores).sort(
    ([, a], [, b]) => a - b
  );

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h2 style={{ color: '#ccc', marginBottom: '1rem' }}>
        Category Breakdown
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        {categories.map(([category, score]) => {
          const prevScore = previousCategoryScores?.[category] ?? null;
          const delta = prevScore !== null ? score - prevScore : null;

          return (
            <div
              key={category}
              style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {CATEGORY_LABELS[category] ?? category}
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: scoreColor(score),
                  marginTop: '0.25rem',
                  fontFamily: 'monospace',
                }}
              >
                {score}
              </div>
              {delta !== null && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: delta >= 0 ? '#4a4' : '#f44',
                    marginTop: '0.25rem',
                  }}
                >
                  {delta >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(delta)} from last week
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

```bash
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add app/components/CategoryBreakdown.tsx
git commit -m "feat: add category breakdown component"
```

---

## Task 13: Root Layout and Dark Theme

**Files:**
- Modify: `app/routes/__root.tsx`

- [ ] **Step 1: Update the root layout with dark theme**

Replace the contents of `app/routes/__root.tsx`:

```tsx
// app/routes/__root.tsx
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
```

- [ ] **Step 2: Verify the dark theme renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Page should have a dark background with light text.

- [ ] **Step 3: Commit**

```bash
git add app/routes/__root.tsx
git commit -m "feat: add dark theme root layout"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Ensure database is running and migrated**

```bash
npx drizzle-kit migrate
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Start the dev server and trigger a manual sync**

```bash
npm run dev
```

In a separate terminal:

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "Authorization: Bearer change-me-in-production"
```

Expected: JSON response with `globalScore` and `categoryScores`. This will take a while on first run as it backfills incidents from Jan 1, 2026.

- [ ] **Step 4: Verify the dashboard**

Navigate to `http://localhost:3000`. You should see:
- The Doomsday Clock with the current index score
- A trend chart (may only have one data point from today's sync)
- Category breakdown cards

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete doomsd.ai MVP"
```
