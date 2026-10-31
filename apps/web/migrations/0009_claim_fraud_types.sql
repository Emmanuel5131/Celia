ALTER TABLE "claim" ADD COLUMN "fraud_types" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE "claim" SET "fraud_types" = ARRAY["fraud_type"];
