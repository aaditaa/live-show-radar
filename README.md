# Live Show Radar

**Live demo: https://live-show-radar-pink.vercel.app**

An AI-powered live-show alert system for one user, Karan (home city Bengaluru). It monitors
concert and festival announcements in India for every artist he follows and alerts him the moment
a show is announced, with special attention to early-bird ticket windows.

**The whole app is behind the admin password.** Visiting any page redirects to `/admin` to sign
in. Scheduled scans are unaffected: they authenticate with `CRON_SECRET`, not the session.

> This is a deliberate departure from the original brief, which asked for a public read-only
> dashboard. Anyone who needs to look around, including a reviewer, needs `ADMIN_PASSWORD`.

---

## The problem

Gig announcements in India are scattered and short-lived. A tour gets announced on an artist's
Instagram, picked up by a few music publications, and listed on one of five ticketing platforms —
and the early-bird window, which is where the cheap tickets are, often closes within days. Nobody
checks sixty artists by hand every day.

Live Show Radar does that checking. Every 30 minutes it searches news and ticketing sites for the
artists you follow, uses Gemini to work out which results are genuinely an India show by that
artist, and sends a Telegram alert ranked by how urgently you need to act.

The hard part is not finding announcements. It is **rejecting everything else**: a cricket
headline matched to "Queen", a Nashville gig matched to an Indian band, a Beatles tribute act, a
Harry Styles date at Madison Square Garden. Filtering that noise is what the AI is for.

---

## Architecture

```
GitHub Actions (every 30 min)          Vercel cron (daily 08:00 IST)
            │                                      │
            └──────────────┬───────────────────────┘
                           ▼
                  POST /api/scan   (Bearer CRON_SECRET)
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                  ▼
   Google News RSS    Tavily Search      Spotify sync
   (per artist +      (ticketing sites,  (daily only)
    per alias)         sweep + starred)
         └─────────────────┼──────────────────┘
                           ▼
              Filter: url_hash dedupe, 30-day window
                           ▼
              Gemini Task 1 — extract show candidates
                           ▼
              Triage: India, confidence, upcoming
                           ▼
              dedup_key = artist|city|date
                     │              │
               new show        existing show
                     │              ▼
                     │     Gemini Task 2 — reconcile
                     └──────┬───────┘
                            ▼
              Priority P0–P3 (rules, in code)
                            ▼
              Gemini Task 3 — write the alert
                            ▼
              Telegram  (alert_key enforces once-only)
```

Every stage is isolated: a failure in one source, one artist or one AI call is recorded in the
scan's `errors` column and never fails the run.

## Components map

| # | Component | Built with | Lives in |
| --- | --- | --- | --- |
| 1 | Scheduler | GitHub Actions every 30 min, Vercel cron daily | `.github/workflows/scan.yml`, `vercel.json` |
| 2 | Artist sync | Spotify `GET /me/following`, paste or CSV | `lib/spotify.ts`, `app/api/spotify/*` |
| 3 | News fetcher | Google News RSS | `lib/sources/google-news.ts` |
| 4 | Ticketing search | Tavily Search API, `include_answer: false` | `lib/sources/tavily.ts` |
| 5 | Scan orchestrator | Next.js route on Vercel | `app/api/scan/route.ts` |
| 6 | Filter | `url_hash` unique key | `lib/pipeline/filter.ts` |
| 7 | Show extractor | Gemini Task 1, structured JSON | `lib/ai/extract.ts` |
| 8 | Show matcher | `dedup_key` + Gemini Task 2 | `lib/pipeline/match.ts`, `lib/ai/reconcile.ts` |
| 9 | Prioritiser and alert writer | P0–P3 rules + Gemini Task 3 | `lib/pipeline/priority.ts`, `lib/ai/alert.ts` |
| 10 | Notifier | Telegram Bot API | `lib/notify/telegram.ts` |
| 11 | Database | Postgres on Neon, Drizzle | `db/schema.ts` |
| 12 | Dashboard and logs | Next.js pages | `app/page.tsx`, `app/scans`, `app/how-it-works` |
| 13 | Calendar | Month grid of upcoming shows | `app/calendar/page.tsx` |
| 14 | Artist suggestions | Gemini, similar-artist discovery | `lib/ai/suggest.ts` |

## Data sources

All data is fetched live. **No show is ever hard-coded or mocked.** The only seeded data is the
list of 20 artists in `lib/demo-artists.ts`, which seed as `manual` — identical to anything
typed into the import box.

| Source | Key | What it covers |
| --- | --- | --- |
| **Google News RSS** | none | One query per artist and per alias against the India feed (`hl=en-IN&gl=IN&ceid=IN:en`), windowed to 14 days with `when:14d`. Catches press coverage. |
| **Tavily Search** | `TAVILY_API_KEY` | `search_depth: basic`, `include_answer: false`, country India. Platform sweeps at most every 6 h across District, BookMyShow, Skillbox, SortMyScene and HighApe — each verified to return indexed results. Starred artists get one query a day, capped at 10. |
| **Spotify Web API** | client ID + secret | Authorization Code flow, scope `user-follow-read`, cursor-paginated. Optional. |
| **Gemini grounding** | `GEMINI_API_KEY` | Third source for starred artists using the `google_search` tool, behind `ENABLE_GEMINI_GROUNDING`. Grounding cannot be combined with structured output, so it is used for discovery only — the URLs it grounds on are stored as `gemini_search` items and extracted by Task 1 like any other source. Off by default; it needs a paid tier. |

Google News `<description>` only repeats the headline, so RSS items give the model a title and a
publisher; Tavily items carry real page content.

## AI tasks

Every AI call in this app runs on **Google Gemini Flash** through the official `@google/genai`
SDK, with the model ID read from `GEMINI_MODEL` (default `gemini-3.8-flash`). No other LLM is
used anywhere. Each task uses structured output (`responseMimeType: application/json` plus a JSON
schema), is validated with zod, retries once on invalid output, and is logged to `ai_calls` with
latency and token counts. Generation settings are left at the model's defaults.

| Task | Input | Output | File |
| --- | --- | --- | --- |
| **1 Extract** | Artist names with aliases + unprocessed search items | Show candidates matching the Appendix B schema | `lib/ai/extract.ts` |
| **2 Reconcile** | A stored show + a candidate sharing its `dedup_key` | `same_show`, changed fields, the single material change | `lib/ai/reconcile.ts` |
| **3 Alert** | The show, home city, and the priority already decided | headline, Telegram HTML message, `action_by`, reason | `lib/ai/alert.ts` |
| **Suggest** | Every followed artist, starred ones weighted first | Similar artists likely to play India, each with the artist it resembles | `lib/ai/suggest.ts` |
| **Ground** | A starred artist, when `ENABLE_GEMINI_GROUNDING=true` | URLs found with the `google_search` tool, fed back through Task 1 | `lib/sources/gemini-grounding.ts` |

**Priority is decided in code, never by the model** (`lib/pipeline/priority.ts`). Gemini only
explains it.

- **P0** — Bengaluru *and* early bird open or imminent
- **P1** — Bengaluru, or any Indian city with early bird open and a deadline within 72 h
- **P2** — any other Indian city
- **P3** — confidence below 0.8; shown on the dashboard, never pushed

## Local setup

```bash
git clone https://github.com/aaditaa/live-show-radar.git
cd live-show-radar
npm install
cp .env.example .env.local     # fill in the values below
npm run db:migrate             # apply migrations
npm run db:seed                # Karan + 20 demo artists (idempotent)
npm run dev                    # http://127.0.0.1:3000
```

Use `127.0.0.1`, not `localhost` — Spotify no longer accepts `localhost` as a redirect URI.

| Script | Purpose |
| --- | --- |
| `npm test` | 135 unit tests |
| `npm run db:generate` | Generate a migration from `db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations / seed |
| `npm run db:due` | Mark every artist due, to re-run a scan without waiting |
| `npm run db:studio` | Drizzle Studio |
| `npm run telegram:chat-id` | Print your Telegram chat ID after sending `/start` |

Pages: `/` dashboard, `/calendar` month grid, `/artists` (search, star, remove, suggestions),
`/alerts`, `/scans`, `/how-it-works`, and `/admin` for the password sign-in. Every page except
`/admin` requires a signed-in session, enforced in `middleware.ts`.

Trigger a scan locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3000/api/scan?trigger=manual"
```

## Deploy

```bash
vercel link
# set every variable below for the Production environment
vercel deploy --prod
```

Then:

1. **GitHub repo secrets** (Settings → Secrets → Actions): `APP_URL` and `CRON_SECRET`. The
   workflow fails loudly if either is missing.
2. **Vercel cron** is declared in `vercel.json` and needs no secret of its own — Vercel sends
   `Authorization: Bearer $CRON_SECRET` automatically when that variable exists.
3. **Spotify redirect URI**: add `https://<your-app>.vercel.app/api/spotify/callback` in the
   Spotify dashboard alongside the loopback one. Production must be HTTPS.
4. Run `npm run db:migrate` against the production `DATABASE_URL` once.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | All three AI tasks |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash` |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `TAVILY_API_KEY` | yes | Ticketing search |
| `CRON_SECRET` | yes | Bearer token for `/api/scan` |
| `ADMIN_PASSWORD` | yes | Unlocks admin actions |
| `APP_URL` | yes | Public base URL, used for OAuth redirects |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | for alerts | From @BotFather and `npm run telegram:chat-id` |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REDIRECT_URI` | optional | Follow sync only |
| `ENABLE_GEMINI_GROUNDING` | no | Defaults to `false` |
| `RESEND_API_KEY` / `ALERT_EMAIL` | optional | Email channel, not enabled |

Real values live in `.env.local`, which is git-ignored. `.env.example` lists every name with no
values. Nothing in this repo logs or prints a secret, and Spotify tokens never leave the server.

## Known limitations

- **Alerts depend on the announcement being published online.** If a show is announced only in an
  Instagram story or a closed community, nothing can find it.
- **Polling interval is 30 minutes**, so an alert can lag an announcement by up to that long. The
  daily Vercel cron is a backup, not a second scanner.
- **Spotify Development Mode allows 5 users**, each added to the app allowlist by hand. It also
  requires the *app owner* to hold an active Premium subscription — without it `/me/following`
  returns 403 and the error says so. Manual and CSV import work regardless, and the system is
  designed to run fully without Spotify.
- **Spotify no longer exposes `followers` or `popularity`**, and the batch `GET /artists` endpoint
  is gone, so artists sync with name and image only.
- **Spotify's Recommendations and Related Artists endpoints are unavailable** to apps created
  after November 2024, and to development-mode apps generally. Artist suggestions therefore come
  from Gemini rather than Spotify, which also keeps every AI path on a single provider.
- **Artist images come from Spotify**, so artists added manually show a generated monogram until
  a Spotify sync finds a matching image. The monogram colour is derived from the name, so it is
  stable rather than random.
- **The calendar places only day-precision shows on the grid.** A month-precision or undated show
  is listed separately rather than pinned to a date nobody announced.
- **Tavily's free tier is 1,000 credits a month.** The current cadence costs roughly 790. Starring
  more than 10 artists would exceed it; the caps are named constants in `lib/sources/tavily.ts`.
- **A scan processes at most 15 artists and 400 unprocessed items**, so a large follow list is
  covered across several scans rather than all at once. This is what keeps every function far
  below the 300 s ceiling.
- **The 600-character alert limit is measured against visible text, not raw HTML.** Google News
  article links are ~500-character base64 redirects, so counting `href` attributes would blow the
  budget on the link alone while the message a reader sees stays near 250 characters.
- **Month-precision dates** are stored as the first of the month with `date_precision = 'month'`
  and displayed as "December 2026". A show with no date at all displays "TBA".
- **Rejections are kept, not just counted.** Every candidate the pipeline refuses is stored in
  `rejections` with the reason and the quote it was judged on, and shown under "Filtered out" on
  `/scans`. This is where the AI earns its place: an ABBA tribute night in Pune and a Gorillaz
  concert review from Cleveland are both refused, for different reasons.
- **Email is a second channel, off unless configured.** Set `RESEND_API_KEY` and `ALERT_EMAIL`
  and each alert is also emailed, claimed under its own `alert_key` so an email failure can
  never suppress or duplicate the Telegram one.
- **One user.** The schema supports many, but the scan and the alert path both assume a single
  user row.
- **There is no public view.** `middleware.ts` gates every page on the admin session, so a
  reviewer cannot see the dashboard without the password. To restore the brief's public
  read-only behaviour, delete `middleware.ts`; the per-action checks behind it already
  distinguish admin from visitor on their own.
