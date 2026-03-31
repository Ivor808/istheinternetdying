CREATE TABLE "daily_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"global_score" numeric NOT NULL,
	"category_scores" jsonb NOT NULL,
	CONSTRAINT "daily_index_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "daily_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"date" date NOT NULL,
	"score" numeric NOT NULL,
	CONSTRAINT "daily_scores_provider_date" UNIQUE("provider_id","date")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_provider_external_id" UNIQUE("provider_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"status_page_url" text NOT NULL,
	"provider_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "daily_scores" ADD CONSTRAINT "daily_scores_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;