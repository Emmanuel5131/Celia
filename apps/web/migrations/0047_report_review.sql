ALTER TABLE "case_report" ADD COLUMN "review" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_report" ADD COLUMN "agent_review" jsonb;--> statement-breakpoint
ALTER TABLE "case_report" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "case_report" ADD COLUMN "decided_at" timestamp with time zone;