CREATE TABLE "case_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"hash" text NOT NULL,
	"notebook_url" text,
	"saved_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_report_one_per_version" UNIQUE("case_id","version")
);
--> statement-breakpoint
ALTER TABLE "case_report" ADD CONSTRAINT "case_report_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;