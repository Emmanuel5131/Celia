CREATE TABLE "claim_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"role" text NOT NULL,
	"chain" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_address_once" UNIQUE("claim_id","role","chain","address")
);
--> statement-breakpoint
CREATE TABLE "claim_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"chain" text NOT NULL,
	"hash" text NOT NULL,
	"check" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_transaction_once" UNIQUE("claim_id","chain","hash")
);
--> statement-breakpoint
ALTER TABLE "claim_address" ADD CONSTRAINT "claim_address_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_transaction" ADD CONSTRAINT "claim_transaction_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE no action ON UPDATE no action;