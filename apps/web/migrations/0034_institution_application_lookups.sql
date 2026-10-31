ALTER TABLE "institution_application" ADD COLUMN "lookups" jsonb;--> statement-breakpoint
ALTER TABLE "institution_application" ADD COLUMN "looked_up_at" timestamp with time zone;