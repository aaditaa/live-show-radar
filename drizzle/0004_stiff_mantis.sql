CREATE TABLE "rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_run_id" uuid,
	"artist_id" uuid,
	"claimed_artist" text NOT NULL,
	"reason" text NOT NULL,
	"country" text,
	"city" text,
	"event_date" text,
	"confidence" numeric(3, 2),
	"evidence" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rejections_reason_check" CHECK ("rejections"."reason" in ('not_a_show_announcement','not_india','low_confidence','past_event','no_city','unknown_artist'))
);
--> statement-breakpoint
ALTER TABLE "ai_calls" DROP CONSTRAINT "ai_calls_task_check";--> statement-breakpoint
ALTER TABLE "rejections" ADD CONSTRAINT "rejections_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejections" ADD CONSTRAINT "rejections_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rejections_created_idx" ON "rejections" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_task_check" CHECK ("ai_calls"."task" in ('extract','reconcile','alert','suggest','ground'));