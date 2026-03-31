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
