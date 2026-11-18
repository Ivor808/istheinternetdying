import { db } from '../db/client';
import { providers, incidents, dailyScores, dailyIndex } from '../db/schema';
import { providerConfigs } from '../providers/config';
import { getProvider } from '../providers/registry';
import {
  datesToScore,
  scoreDate,
  toDateStr,
  updateCoverage,
  type ScoringIncident,
  type ScoringProvider,
} from '../scoring/daily-index';
import { and, eq, inArray, isNotNull, notInArray, sql } from 'drizzle-orm';
import { syncCVECounts } from './cve-sync';

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

type ProviderRow = typeof providers.$inferSelect;

async function fetchSingleProvider(
  provider: ProviderRow,
  idx: number,
  total: number,
): Promise<{ slug: string; error?: unknown }> {
  try {
    console.log(`[sync] ${idx + 1}/${total} ${provider.slug}...`);
    const plugin = getProvider(provider.providerType);

    // Taken before the request so coverage never claims more than the fetch saw
    const fetchedAt = new Date();
    const { incidents: fetched, excludedIds, oldestListedAt } = await plugin.fetchIncidents(
      provider.statusPageUrl
    );
    console.log(`[sync] ${provider.slug}: ${fetched.length} incidents`);

    // Upsert everything the feed returns: incidents resolved or reclassified
    // since the last run get their new data
    if (fetched.length > 0) {
      await db
        .insert(incidents)
        .values(
          fetched.map((incident) => ({
            providerId: provider.id,
            externalId: incident.externalId,
            title: incident.title,
            severity: incident.severity,
            startedAt: incident.startedAt,
            resolvedAt: incident.resolvedAt,
            raw: incident.raw,
          }))
        )
        .onConflictDoUpdate({
          target: [incidents.providerId, incidents.externalId],
          set: {
            title: sql`excluded.title`,
            severity: sql`excluded.severity`,
            startedAt: sql`excluded.started_at`,
            resolvedAt: sql`excluded.resolved_at`,
            raw: sql`excluded.raw`,
          },
        });
    }

    // Incidents since reclassified as maintenance/informational stop counting
    if (excludedIds.length > 0) {
      await db
        .delete(incidents)
        .where(
          and(
            eq(incidents.providerId, provider.id),
            inArray(incidents.externalId, excludedIds)
          )
        );
    }

    const coverage = updateCoverage(provider, oldestListedAt, fetchedAt);
    await db
      .update(providers)
      .set({ coverageStart: coverage.coverageStart, lastFetchedAt: coverage.lastFetchedAt })
      .where(eq(providers.id, provider.id));

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

// Providers configured for tracking, with coverage and all their incidents
async function loadScoringProviders(): Promise<ScoringProvider[]> {
  const configured = new Set(providerConfigs.map((c) => c.slug));
  const rows = (await db.select().from(providers)).filter((p) => configured.has(p.slug));
  const incidentRows = await db
    .select({
      providerId: incidents.providerId,
      severity: incidents.severity,
      startedAt: incidents.startedAt,
      resolvedAt: incidents.resolvedAt,
    })
    .from(incidents);

  const byProvider = new Map<number, ScoringIncident[]>();
  for (const r of incidentRows) {
    const list = byProvider.get(r.providerId) ?? [];
    list.push({
      severity: r.severity as ScoringIncident['severity'],
      startedAt: r.startedAt,
      resolvedAt: r.resolvedAt,
    });
    byProvider.set(r.providerId, list);
  }

  return rows.map((p) => ({
    id: p.id,
    category: p.category,
    coverageStart: p.coverageStart,
    lastFetchedAt: p.lastFetchedAt,
    incidents: byProvider.get(p.id) ?? [],
  }));
}

export interface ScoredDate {
  date: string;
  globalScore: number | null;
  coveredProviders: number;
  totalProviders: number;
}

/**
 * Score each (completed) date and store provider scores and the index row.
 * Uncovered providers are left out of the date entirely; the index row
 * records how many providers were covered so readers can hide thin dates.
 */
export async function computeAndStoreScores(
  dates: Date[],
  scoringProviders?: ScoringProvider[]
): Promise<ScoredDate[]> {
  const all = scoringProviders ?? (await loadScoringProviders());
  const results: ScoredDate[] = [];

  for (const date of dates) {
    const dateStr = toDateStr(date);
    const result = scoreDate(all, date);

    for (const { providerId, score } of result.providerScores) {
      await db
        .insert(dailyScores)
        .values({ providerId, date: dateStr, score: String(score) })
        .onConflictDoUpdate({
          target: [dailyScores.providerId, dailyScores.date],
          set: { score: sql`excluded.score` },
        });
    }

    // A provider that lost coverage for this date shouldn't keep an old score
    const scoredIds = result.providerScores.map((s) => s.providerId);
    await db
      .delete(dailyScores)
      .where(
        scoredIds.length > 0
          ? and(eq(dailyScores.date, dateStr), notInArray(dailyScores.providerId, scoredIds))
          : eq(dailyScores.date, dateStr)
      );

    if (result.globalScore !== null) {
      await db
        .insert(dailyIndex)
        .values({
          date: dateStr,
          globalScore: String(result.globalScore),
          categoryScores: result.categoryScores,
          coveredProviders: result.coveredProviders,
          totalProviders: result.totalProviders,
        })
        .onConflictDoUpdate({
          target: dailyIndex.date,
          set: {
            globalScore: sql`excluded.global_score`,
            categoryScores: sql`excluded.category_scores`,
            coveredProviders: sql`excluded.covered_providers`,
            totalProviders: sql`excluded.total_providers`,
          },
        });
    }

    results.push({
      date: dateStr,
      globalScore: result.globalScore,
      coveredProviders: result.coveredProviders,
      totalProviders: result.totalProviders,
    });
  }

  return results;
}

/**
 * Fetch every feed, then score completed days only: the trailing window is
 * rescored every run so rows settle once late updates are in, and any earlier
 * day that could be covered but has no coverage-aware row yet is filled in.
 */
export async function runDailySync(): Promise<{
  scored: number;
  latest: ScoredDate | null;
}> {
  await syncProviders();
  const { providerErrors } = await fetchAndStoreIncidents();
  if (providerErrors.length > 0) {
    console.warn(`${providerErrors.length} provider(s) failed during incident fetch:`, providerErrors.map((e) => e.slug));
  }

  const scoringProviders = await loadScoringProviders();
  const scoredRows = await db
    .select({ date: dailyIndex.date })
    .from(dailyIndex)
    .where(isNotNull(dailyIndex.coveredProviders));
  const dates = datesToScore(
    new Date(),
    scoringProviders,
    new Set(scoredRows.map((r) => r.date))
  );

  console.log(`[sync] Scoring ${dates.length} day(s)...`);
  const results = await computeAndStoreScores(dates, scoringProviders);
  for (const r of results) {
    console.log(`[sync] ${r.date}: index ${r.globalScore?.toFixed(2) ?? '—'} (${r.coveredProviders}/${r.totalProviders} providers covered)`);
  }

  await syncCVECounts();
  return { scored: results.length, latest: results[results.length - 1] ?? null };
}
