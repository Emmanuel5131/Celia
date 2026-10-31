CREATE TABLE "case_story" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"kind" text,
	"claimants_saying" integer DEFAULT 0 NOT NULL,
	"claimants_total" integer DEFAULT 0 NOT NULL,
	"confirmed" integer DEFAULT 0 NOT NULL,
	"wallets" text,
	"estimated_loss" text,
	"headline" text,
	"contradictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_story" ADD CONSTRAINT "case_story_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;