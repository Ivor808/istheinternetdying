import { db } from '../db/client';
import { providers, incidents, dailyScores, dailyIndex } from '../db/schema';
import { providerConfigs } from '../providers/config';
import { getProvider } from '../providers/registry';
import { computeRollingScore } from '../scoring/provider-score';
import {
  computeCategoryScores,
  computeGlobalIndex,
} from '../scoring/aggregation';
import { eq, and, or, sql, gte, lte, isNull } from 'drizzle-orm';

const BACKFILL_START = new Date('2024-01-01T00:00:00Z');
const DAILY_START = new Date('2026-01-01T00:00:00Z');

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

async function fetchSingleProvider(
  provider: { id: number; slug: string; providerType: string; statusPageUrl: string },
  idx: number,
  total: number,
): Promise<{ slug: string; error?: unknown }> {
  try {
    console.log(`[sync] ${idx + 1}/${total} ${provider.slug}...`);
    const plugin = getProvider(provider.providerType);

    const existing = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(eq(incidents.providerId, provider.id))
      .limit(1);

    const since = existing.length === 0 ? BACKFILL_START : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const fetched = await plugin.fetchIncidents(
      provider.statusPageUrl,
      since
    );
    console.log(`[sync] ${provider.slug}: ${fetched.length} incidents`);

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
    return { slug: provider.slug };
  } catch (err) {
    console.error(`[sync] Failed: ${provider.slug}:`, err instanceof Error ? err.message : err);
    return { slug: provider.slug, error: err };
  }
}

const CONCURRENCY = 5;

export async function fetchAndStoreIncidents(): Promise<{ providerErrors: Array<{ slug: string; error: unknown }> }> {
  const allProviders = await db.select().from(providers);
  const providerErrors: Array<{ slug: string; error: unknown }> = [];

  const mem = () => `${Math.round(process.memoryUsage.rss() / 1024 / 1024)}MB`;
  console.log(`[sync] Fetching incidents for ${allProviders.length} providers (${CONCURRENCY} at a time) [${mem()}]`);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < allProviders.length; i += CONCURRENCY) {
    const batch = allProviders.slice(i, i + CONCURRENCY);
    const batchStart = Date.now();
    const results = await Promise.all(
      batch.map((provider, batchIdx) =>
        fetchSingleProvider(provider, i + batchIdx, allProviders.length)
      )
    );
    const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
    console.log(`[sync] Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(allProviders.length / CONCURRENCY)} done (${elapsed}s) [${mem()}]`);
    for (const result of results) {
      if (result.error) {
        providerErrors.push({ slug: result.slug, error: result.error });
      }
    }
  }

  return { providerErrors };
}

export async function computeAndStoreScores(
  date: Date
): Promise<{ globalScore: number; categoryScores: Record<string, number> }> {
  const allProviders = await db.select().from(providers);
  const sevenDaysAgo = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);

  const providerScoreEntries: { category: string; score: number }[] = [];

  for (const provider of allProviders) {
    // Check if this provider has ANY incident data at or before this date.
    // No data means we can't distinguish "perfect uptime" from "no coverage" —
    // so we omit the provider entirely rather than assuming 100.
    const [hasData] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.providerId, provider.id),
          lte(incidents.startedAt, date)
        )
      )
      .limit(1);

    if (!hasData) continue;

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
          lte(incidents.startedAt, date),
          or(
            isNull(incidents.resolvedAt),
            gte(incidents.resolvedAt, sevenDaysAgo)
          )
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

/**
 * Generate score dates: monthly (1st of month) from BACKFILL_START to DAILY_START,
 * then daily from DAILY_START to today.
 */
function getScoreDates(today: Date): Date[] {
  const dates: Date[] = [];

  // Monthly from Jan 2024 through Dec 2025
  const cursor = new Date(BACKFILL_START);
  while (cursor < DAILY_START) {
    dates.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Daily from Jan 1, 2026 through today
  const dayCursor = new Date(DAILY_START);
  while (dayCursor <= today) {
    dates.push(new Date(dayCursor));
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Check if we need to backfill by looking for any existing daily_index rows.
 */
async function needsBackfill(): Promise<boolean> {
  const existing = await db
    .select({ id: dailyIndex.id })
    .from(dailyIndex)
    .limit(1);
  return existing.length === 0;
}

export async function runDailySync(): Promise<{
  globalScore: number;
  categoryScores: Record<string, number>;
  backfilled: boolean;
}> {
  await syncProviders();
  const { providerErrors } = await fetchAndStoreIncidents();
  if (providerErrors.length > 0) {
    console.warn(`${providerErrors.length} provider(s) failed during incident fetch:`, providerErrors.map((e) => e.slug));
  }

  const today = new Date();
  const backfill = await needsBackfill();

  if (backfill) {
    console.log('No existing index data — running full backfill...');
    const dates = getScoreDates(today);
    console.log(`Computing scores for ${dates.length} dates (monthly 2024-2025, daily 2026+)...`);
    let lastResult = { globalScore: 100, categoryScores: {} as Record<string, number> };
    for (let i = 0; i < dates.length; i++) {
      lastResult = await computeAndStoreScores(dates[i]);
      if ((i + 1) % 6 === 0 || i === dates.length - 1) {
        console.log(`  ${i + 1}/${dates.length} — ${dates[i].toISOString().split('T')[0]} → index ${lastResult.globalScore}`);
      }
    }
    return { ...lastResult, backfilled: true };
  }

  const result = await computeAndStoreScores(today);
  return { ...result, backfilled: false };
}
