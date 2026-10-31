ALTER TABLE "claim" ADD COLUMN "staff_review_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "rejection_note" text;