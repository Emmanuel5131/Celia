CREATE TABLE "claim_agent_review" (
	"claim_id" uuid PRIMARY KEY NOT NULL,
	"interesting" boolean NOT NULL,
	"message" text NOT NULL,
	"reviewed_by" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_agent_review" ADD CONSTRAINT "claim_agent_review_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;