CREATE TABLE "monthly_cves" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "monthly_cves_date_unique" UNIQUE("date")
);
