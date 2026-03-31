import { db } from '../db/client';
import { dailyIndex, dailyScores, providers } from '../db/schema';
import { desc, eq, sql, inArray } from 'drizzle-orm';

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
  const [current] = await db
    .select()
    .from(dailyIndex)
    .orderBy(desc(dailyIndex.date))
    .limit(1);

  let previous: typeof current | undefined;
  if (current) {
    const currentDate = new Date(current.date + 'T00:00:00Z');
    const sevenDaysBefore = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysBeforeStr = sevenDaysBefore.toISOString().split('T')[0];
    const [previousRow] = await db
      .select()
      .from(dailyIndex)
      .where(eq(dailyIndex.date, sevenDaysBeforeStr))
      .limit(1);
    previous = previousRow;
  }

  const history = await db
    .select({
      date: dailyIndex.date,
      globalScore: dailyIndex.globalScore,
      categoryScores: dailyIndex.categoryScores,
    })
    .from(dailyIndex)
    .orderBy(dailyIndex.date);

  const notableProviderRows = await db
    .select({ id: providers.id, slug: providers.slug, name: providers.name })
    .from(providers)
    .where(inArray(providers.slug, NOTABLE_PROVIDERS));

  let providerHistory: DashboardData['providerHistory'] = [];
  for (const p of notableProviderRows) {
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
