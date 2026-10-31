CREATE TABLE "case_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"occurred_on" date,
	"jurisdiction" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_evidence" ADD COLUMN "action_id" uuid;--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_action_case" ON "case_action" USING btree ("case_id");--> statement-breakpoint
ALTER TABLE "case_evidence" ADD CONSTRAINT "case_evidence_action_id_case_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."case_action"("id") ON DELETE set null ON UPDATE no action;