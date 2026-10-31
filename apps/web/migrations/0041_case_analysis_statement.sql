ALTER TABLE "case_analysis" ADD COLUMN "statement_id" uuid;--> statement-breakpoint
ALTER TABLE "case_analysis" ADD CONSTRAINT "case_analysis_statement_id_case_statement_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."case_statement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "case_analysis" SET "statement_id" = "case_statement"."id" FROM "case_statement" WHERE "case_statement"."case_id" = "case_analysis"."case_id" AND "case_statement"."text" = "case_analysis"."brief"->'platformStatements'->0->>'text';
