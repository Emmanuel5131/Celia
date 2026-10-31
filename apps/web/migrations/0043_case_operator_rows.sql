ALTER TABLE "case" ADD COLUMN "operator_rows" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "case" SET "operator_rows" = (
	SELECT jsonb_agg(jsonb_build_object(
		'name', 'Operators',
		'role', 'other',
		'jurisdiction', listed.id,
		'notes', CASE WHEN listed.n = 1 THEN "case"."operators" END
	) ORDER BY listed.n)
	FROM jsonb_array_elements_text(
		CASE WHEN jsonb_array_length("case"."operator_jurisdictions") = 0 THEN '[null]'::jsonb ELSE "case"."operator_jurisdictions" END
	) WITH ORDINALITY AS listed(id, n)
)
WHERE "operators" IS NOT NULL OR jsonb_array_length("operator_jurisdictions") > 0;
