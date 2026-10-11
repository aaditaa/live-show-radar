CREATE TABLE "artist_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"similar_to" text,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_suggestions_status_check" CHECK ("artist_suggestions"."status" in ('pending','added','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "artist_suggestions" ADD CONSTRAINT "artist_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artist_suggestions_user_name" ON "artist_suggestions" USING btree ("user_id",lower("name"));