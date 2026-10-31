ALTER TABLE "claim" ALTER COLUMN "wallet_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ALTER COLUMN "platform_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ALTER COLUMN "platform_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "fraud_type" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "payment_method" text DEFAULT 'wallet' NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "tx_hash" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "platform_host" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "operator_handle" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "token_contract" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "contact_channel" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "amount_lost" text;