CREATE TABLE "case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"platform_key" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "case_seq_unique" UNIQUE("seq"),
	CONSTRAINT "case_platform_key_unique" UNIQUE("platform_key")
);
--> statement-breakpoint
CREATE TABLE "case_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"conflicts_confirmed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "case_team_one_row_per_lawyer" UNIQUE("case_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "case_team" ADD CONSTRAINT "case_team_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_team_one_lead" ON "case_team" USING btree ("case_id") WHERE "case_team"."role" = 'lead';