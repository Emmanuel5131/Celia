ALTER TABLE "claim" ADD COLUMN "destination_address" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "first_payment_on" date;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "last_payment_on" date;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "asset_sent" text;