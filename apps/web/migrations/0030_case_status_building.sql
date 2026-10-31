ALTER TABLE "case" ALTER COLUMN "status" SET DEFAULT 'building';
--> statement-breakpoint
UPDATE "case" SET "status" = 'building' WHERE "status" = 'collecting';
--> statement-breakpoint
INSERT INTO "case" ("name", "platform_key", "status")
SELECT DISTINCT ON ("platform_key") "platform_name", "platform_key", 'building'
FROM "claim"
WHERE "status" = 'submitted'
  AND "platform_key" IS NOT NULL AND "platform_key" <> ''
  AND "platform_name" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "case" WHERE "case"."platform_key" = "claim"."platform_key")
ORDER BY "platform_key", "submitted_at";
