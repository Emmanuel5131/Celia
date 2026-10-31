CREATE TABLE "case_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"source_url" text,
	"captured_on" date,
	"cid" text,
	"pin_id" text,
	"file_name" text,
	"mime_type" text,
	"size_bytes" bigint,
	"chain" text,
	"reference" text,
	"statement_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_evidence" ADD CONSTRAINT "case_evidence_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_evidence" ADD CONSTRAINT "case_evidence_statement_id_case_statement_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."case_statement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_evidence_case" ON "case_evidence" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_evidence_pin" ON "case_evidence" USING btree ("pin_id");