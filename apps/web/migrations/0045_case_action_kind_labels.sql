ALTER TABLE "case_action" ALTER COLUMN "kind" DROP NOT NULL;
--> statement-breakpoint
UPDATE "case_action" SET "kind" = CASE "kind"
	WHEN 'statement' THEN 'Public statement'
	WHEN 'deposits' THEN 'Took deposits'
	WHEN 'withdrawals' THEN 'Limited withdrawals'
	WHEN 'funds_moved' THEN 'Moved funds'
	WHEN 'promotion' THEN 'Promoted the platform'
	ELSE NULL
END;
