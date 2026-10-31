CREATE TABLE "contact_request_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"answer" text DEFAULT 'pending' NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_request_claim_once" UNIQUE("request_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "contact_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"requester_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"purpose" text,
	"asker_role" text,
	"reason" text,
	"declarations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text,
	"submitted_at" timestamp with time zone,
	"agent_review" jsonb,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"released_by" text,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_request_claim" ADD CONSTRAINT "contact_request_claim_request_id_contact_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."contact_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_request_claim" ADD CONSTRAINT "contact_request_claim_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_request" ADD CONSTRAINT "contact_request_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_request_claim_by_user" ON "contact_request_claim" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_request_by_requester" ON "contact_request" USING btree ("requester_id","created_at");