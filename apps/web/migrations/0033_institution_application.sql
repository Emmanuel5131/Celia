CREATE TABLE "institution_application" (
	"user_id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"organisation" text,
	"registration_number" text,
	"website" text,
	"contact_role" text,
	"status" text DEFAULT 'in_review' NOT NULL,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ready_by" text,
	"ready_at" timestamp with time zone,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_due_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counsel_profile" ADD COLUMN "kind" text DEFAULT 'law_firm' NOT NULL;