ALTER TABLE "case_evidence" ADD COLUMN "review_state" text DEFAULT 'not_reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_evidence" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "case_evidence" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "case_evidence" ADD COLUMN "reviewed_at" timestamp with time zone;