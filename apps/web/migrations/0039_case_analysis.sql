CREATE TABLE "case_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"run" integer NOT NULL,
	"brief" jsonb NOT NULL,
	"template_id" text NOT NULL,
	"template_version" text NOT NULL,
	"commitment" text NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_analysis_run" UNIQUE("case_id","run")
);
--> statement-breakpoint
CREATE TABLE "case_statement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"source_url" text NOT NULL,
	"said_on" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_analysis" ADD CONSTRAINT "case_analysis_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_statement" ADD CONSTRAINT "case_statement_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_statement_case" ON "case_statement" USING btree ("case_id");