CREATE TABLE "identity_check" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"verification_id" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"verified_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
