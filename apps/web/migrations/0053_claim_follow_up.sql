CREATE TABLE "claim_follow_up" (
	"claim_id" uuid PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"value" text,
	"best_time" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_follow_up" ADD CONSTRAINT "claim_follow_up_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;