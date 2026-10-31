ALTER TABLE "case" ALTER COLUMN "status" SET DEFAULT 'collecting';--> statement-breakpoint
ALTER TABLE "case" ADD COLUMN "estimated_loss_usd" bigint;
--> statement-breakpoint
UPDATE "case" SET "status" = 'collecting' WHERE "status" = 'building';
