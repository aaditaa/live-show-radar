CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_run_id" uuid,
	"task" text NOT NULL,
	"model" text NOT NULL,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"success" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_calls_task_check" CHECK ("ai_calls"."task" in ('extract','reconcile','alert'))
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"channel" text NOT NULL,
	"alert_key" text NOT NULL,
	"message" text NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	CONSTRAINT "alerts_alert_key_unique" UNIQUE("alert_key"),
	CONSTRAINT "alerts_alert_type_check" CHECK ("alerts"."alert_type" in ('new_show','early_bird_opened','early_bird_deadline_soon','show_updated')),
	CONSTRAINT "alerts_channel_check" CHECK ("alerts"."channel" in ('telegram','email')),
	CONSTRAINT "alerts_delivery_status_check" CHECK ("alerts"."delivery_status" in ('pending','sent','failed'))
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"spotify_id" text,
	"image_url" text,
	"source" text NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_user_id_spotify_id_key" UNIQUE("user_id","spotify_id"),
	CONSTRAINT "artists_source_check" CHECK ("artists"."source" in ('spotify','manual','demo'))
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"artists_scanned" integer DEFAULT 0 NOT NULL,
	"sweep_ran" boolean DEFAULT false NOT NULL,
	"items_fetched" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"gemini_calls" integer DEFAULT 0 NOT NULL,
	"shows_new" integer DEFAULT 0 NOT NULL,
	"shows_updated" integer DEFAULT 0 NOT NULL,
	"alerts_sent" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "scan_runs_trigger_check" CHECK ("scan_runs"."trigger" in ('github_actions','vercel_cron','manual'))
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"dedup_key" text NOT NULL,
	"event_name" text,
	"is_festival" boolean DEFAULT false NOT NULL,
	"festival_name" text,
	"city" text NOT NULL,
	"venue" text,
	"event_date" date,
	"date_precision" text DEFAULT 'day' NOT NULL,
	"ticket_platform" text,
	"ticket_url" text,
	"on_sale_at" timestamp with time zone,
	"status" text DEFAULT 'announced' NOT NULL,
	"early_bird_status" text DEFAULT 'not_mentioned' NOT NULL,
	"early_bird_opens_at" timestamp with time zone,
	"early_bird_deadline" timestamp with time zone,
	"early_bird_note" text,
	"priority" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"evidence" text,
	"source_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shows_dedup_key_unique" UNIQUE("dedup_key"),
	CONSTRAINT "shows_date_precision_check" CHECK ("shows"."date_precision" in ('day','month')),
	CONSTRAINT "shows_status_check" CHECK ("shows"."status" in ('announced','on_sale','sold_out','cancelled')),
	CONSTRAINT "shows_early_bird_status_check" CHECK ("shows"."early_bird_status" in ('open','imminent','sold_out','closed','not_mentioned')),
	CONSTRAINT "shows_priority_check" CHECK ("shows"."priority" in ('P0','P1','P2','P3'))
);
--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_run_id" uuid,
	"artist_id" uuid,
	"source" text NOT NULL,
	"query" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"title" text,
	"snippet" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "source_items_url_hash_unique" UNIQUE("url_hash"),
	CONSTRAINT "source_items_source_check" CHECK ("source_items"."source" in ('google_news','tavily','gemini_search'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"home_city" text DEFAULT 'Bengaluru' NOT NULL,
	"telegram_chat_id" text,
	"email" text,
	"spotify_user_id" text,
	"spotify_access_token" text,
	"spotify_refresh_token" text,
	"spotify_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shows" ADD CONSTRAINT "shows_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artists_user_name" ON "artists" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "artists_next_check_idx" ON "artists" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "shows_city_idx" ON "shows" USING btree ("city");--> statement-breakpoint
CREATE INDEX "shows_event_date_idx" ON "shows" USING btree ("event_date");