ALTER TABLE "case_report" DROP CONSTRAINT "case_report_one_per_version";--> statement-breakpoint
ALTER TABLE "case_report" ADD COLUMN "analysis_id" uuid;--> statement-breakpoint
ALTER TABLE "case_report" ADD CONSTRAINT "case_report_analysis_id_case_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."case_analysis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "case_report" SET "analysis_id" = "case_analysis"."id" FROM "case_analysis" WHERE "case_analysis"."case_id" = "case_report"."case_id" AND "case_analysis"."commitment" = "case_report"."snapshot"->'method'->>'commitment';--> statement-breakpoint
ALTER TABLE "case_report" ADD CONSTRAINT "case_report_one_per_version" UNIQUE("analysis_id","version");