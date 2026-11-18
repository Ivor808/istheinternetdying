ALTER TABLE "daily_index" ADD COLUMN "covered_providers" integer;--> statement-breakpoint
ALTER TABLE "daily_index" ADD COLUMN "total_providers" integer;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "coverage_start" timestamp;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "last_fetched_at" timestamp;--> statement-breakpoint
-- One-off data fixes for rows stored before this migration.
-- Incident start is now the provider's started_at (falls back to created_at).
UPDATE "incidents" SET "started_at" = ("raw"->>'started_at')::timestamptz AT TIME ZONE 'UTC'
WHERE "raw"->>'started_at' IS NOT NULL;--> statement-breakpoint
-- Maintenance (and any other non-outage impact) used to be stored as minor outages.
DELETE FROM "incidents" WHERE "raw"->>'impact' IS NOT NULL AND "raw"->>'impact' NOT IN ('minor', 'major', 'critical');--> statement-breakpoint
-- Coverage so far: stored incidents are complete from the oldest one we have.
-- The last insert stands in for the last fetch; the next run's overlap check
-- (oldest listed incident <= last fetch) only passes if the feed still
-- contains an incident we already stored, i.e. nothing was missed since.
UPDATE "providers" p SET
  "coverage_start" = c."first_created",
  "last_fetched_at" = c."last_inserted"
FROM (
  SELECT "provider_id",
    MIN(("raw"->>'created_at')::timestamptz AT TIME ZONE 'UTC') AS "first_created",
    MAX("created_at") AS "last_inserted"
  FROM "incidents"
  WHERE "raw"->>'created_at' IS NOT NULL
  GROUP BY "provider_id"
) c
WHERE p."id" = c."provider_id";
