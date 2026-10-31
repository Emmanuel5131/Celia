CREATE TABLE "claim_proof" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "ownership_method" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "proof_note" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "review_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "claim_proof" ADD CONSTRAINT "claim_proof_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_proof_claim_idx" ON "claim_proof" USING btree ("claim_id");--> statement-breakpoint
UPDATE "claim" SET "ownership_method" = 'signature' WHERE "ownership" = 'signed';
