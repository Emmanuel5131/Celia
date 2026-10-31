CREATE TABLE "claim_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"changes" jsonb NOT NULL,
	"state_before" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_revision" ADD CONSTRAINT "claim_revision_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_revision_by_claim" ON "claim_revision" USING btree ("claim_id","created_at");