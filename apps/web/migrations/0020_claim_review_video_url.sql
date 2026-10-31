ALTER TABLE "claim" ADD COLUMN "review_video_url" text;--> statement-breakpoint
UPDATE "claim" SET "ownership" = 'unsigned', "review_kind" = NULL, "proof_note" = NULL, "review_requested_at" = NULL WHERE "review_kind" = 'call';
