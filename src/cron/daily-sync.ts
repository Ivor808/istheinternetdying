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
