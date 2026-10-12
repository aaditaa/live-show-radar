from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

OUT = "/Users/aaditaavashisht/code/live-show-radar/docs/components-map.pdf"

INK = colors.HexColor("#1f2430")
HEAD = colors.HexColor("#273449")
LINE = colors.HexColor("#c9d2e0")
ZEBRA = colors.HexColor("#f4f7fb")
ACCENT = colors.HexColor("#c2410c")

styles = getSampleStyleSheet()
cell = ParagraphStyle("cell", parent=styles["BodyText"], fontName="Helvetica",
                      fontSize=7.4, leading=9.4, alignment=TA_LEFT,
                      textColor=INK, spaceAfter=0, spaceBefore=0)
cell_b = ParagraphStyle("cellb", parent=cell, fontName="Helvetica-Bold")
cell_ai = ParagraphStyle("cellai", parent=cell, textColor=ACCENT)
cell_mono = ParagraphStyle("cellm", parent=cell, fontName="Courier", fontSize=6.7, leading=8.6)
head = ParagraphStyle("head", parent=cell, fontName="Helvetica-Bold", fontSize=8,
                      leading=10, textColor=colors.white)
title = ParagraphStyle("title", parent=styles["Title"], fontSize=17, leading=21,
                       textColor=INK, spaceAfter=2)
sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=8.6, leading=12,
                     textColor=colors.HexColor("#5b6678"))
h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=10.5, leading=13,
                    textColor=INK, spaceBefore=10, spaceAfter=4)
note = ParagraphStyle("note", parent=sub, fontSize=7.8, leading=10.4)

COLS = ["Actor / Platform", "Trigger", "Input", "Context", "Processing", "AI", "Output"]

# Actor, Trigger, Input, Context, Processing, AI, Output
ROWS = [
    ("1. Scheduler<br/>GitHub Actions + Vercel Cron",
     "Cron: every 30 min; Vercel daily 02:30 UTC (08:00 IST); manual dispatch",
     "None",
     "APP_URL and CRON_SECRET as repository secrets; concurrency group prevents overlap",
     "curl POST to /api/scan with a bearer token; fails the step on any non-2xx",
     "—",
     "A scan run; JSON summary written to the Actions run summary"),

    ("2. Scan orchestrator<br/>Next.js route on Vercel",
     "GET or POST /api/scan",
     "trigger type; Authorization: Bearer CRON_SECRET or an admin session",
     "scan_runs row; artists due by next_check_at; 300 s function ceiling",
     "Opens a run, picks a bounded batch of 15 artists, fans out sources at concurrency 5 with 10 s timeouts, then closes the run with counts and per-source errors",
     "—",
     "scan_runs row; JSON summary of artists, items, shows, alerts and errors"),

    ("3. Artist sync<br/>Spotify Web API",
     "Daily Vercel cron, or Sync Spotify in the admin UI",
     "GET /v1/me/following?type=artist&limit=50, cursor-paginated",
     "OAuth tokens stored server-side and refreshed; scope user-follow-read",
     "Inserts new follows; reactivates re-followed artists; deactivates unfollowed ones. Never touches manual artists",
     "—",
     "artists rows with source 'spotify', names and images"),

    ("4. Artist intake<br/>Search, paste, CSV",
     "Admin types in the header search, or pastes/imports CSV",
     "Free-text query, or one name per line with optional aliases",
     "Spotify catalogue via app-level token; existing list used to flag duplicates",
     "Debounced catalogue search with a conservative name match; quote-aware CSV parsing; conflicts ignored",
     "—",
     "artists rows with source 'manual', with Spotify artwork"),

    ("5. News fetcher<br/>Google News RSS",
     "Every scan, per artist and per alias",
     'Query: "&lt;artist&gt;" (India OR Bengaluru OR …) (concert OR tour OR tickets …) when:14d',
     "India feed: hl=en-IN, gl=IN, ceid=IN:en. No API key",
     "Fetches and parses XML with fast-xml-parser; normalises to {source, url, title, snippet, published_at}",
     "—",
     "Normalised items, source 'google_news'"),

    ("6. Ticketing search<br/>Tavily Search API",
     "Platform sweep at most every 6 h; one query a day per priority artist",
     "Sweep queries, or '&lt;artist&gt; India tour tickets'",
     "search_depth basic, include_answer false, country india; include_domains for District, BookMyShow, Skillbox, SortMyScene, HighApe; free tier 1,000 credits/month",
     "POST /search, normalises results; caps enforced in code against the database",
     "—",
     "Normalised items, source 'tavily'"),

    ("7. Grounded search<br/>Gemini google_search tool",
     "Starred artists only, when ENABLE_GEMINI_GROUNDING is true (off by default)",
     "Natural-language prompt asking only about India dates and ticket windows",
     "Paid tier; cannot be combined with structured output",
     "Harvests the URLs the model grounded on; the model's prose is kept only as a snippet, never trusted as fact",
     "Gemini Flash — <b>ground</b>",
     "Normalised items, source 'gemini_search'; an ai_calls row"),

    ("8. Filter<br/>Deduplication",
     "After every fetch",
     "All normalised items from this scan",
     "url_hash unique index across all previous scans; 30-day age window",
     "Canonicalises the URL (strips utm/fbclid/oc, sorts params, drops www and fragments), SHA-256 hashes it, drops duplicates and stale items",
     "—",
     "source_items rows; only genuinely new items continue"),

    ("9. Show extractor<br/>Gemini Task 1",
     "Any artist with unprocessed items; one call per artist, plus one for sweep items",
     "Artist names with aliases, plus up to 25 unprocessed items",
     "Appendix B JSON schema; today's date; full artist list for sweep items",
     "Structured JSON output validated with Zod, one retry on invalid output; reports near misses honestly instead of dropping them",
     "Gemini Flash — <b>extract</b>",
     "Show candidates with evidence quotes and a source URL"),

    ("10. Triage and matcher<br/>Rules in code",
     "Immediately after extraction",
     "Show candidates",
     "Keep rules: is_show_announcement, country = India, confidence ≥ 0.7, date today or later",
     "Builds dedup_key = artist_id | normalised city | event_date, normalising Bangalore, Gurgaon, Bombay and New Delhi; refuses invalid calendar dates",
     "—",
     "Accepted candidates, or a typed rejection reason"),

    ("11. Rejection log",
     "Whenever triage refuses a candidate",
     "The refused candidate and its reason",
     "Six reasons: not a show, not India, low confidence, past event, no city, unknown artist",
     "Stores the claimed artist, country, city, confidence, evidence quote and source URL",
     "—",
     "rejections rows, shown on /filtered and filterable by reason"),

    ("12. Reconciler<br/>Gemini Task 2",
     "A candidate whose dedup_key already exists",
     "The stored show and the new candidate",
     "A null from the model means unreported, never cleared",
     "Decides same_show, lists changed fields and the single material change; merges only fields the candidate actually states",
     "Gemini Flash — <b>reconcile</b>",
     "Updated show row; a material-change flag when it is worth an alert"),

    ("13. Prioritiser<br/>Rules in code",
     "Every new show and every material change",
     "City, confidence, early-bird status and deadline",
     "P0 Bengaluru with early bird open or imminent; P1 Bengaluru or a deadline within 72 h; P2 elsewhere in India; P3 confidence below 0.8",
     "Deterministic. The model never sets priority — it only explains it",
     "—",
     "A priority of P0 to P3 stored on the show"),

    ("14. Alert writer<br/>Gemini Task 3",
     "Every new show, material change and early-bird reminder",
     "The show, home city, the priority already decided, and the tag",
     "Telegram HTML only; 600-character budget measured on visible text, not markup",
     "Writes headline, message, action_by and the reason for the priority; a P3 never reaches this step",
     "Gemini Flash — <b>alert</b>",
     "Alert text ready to send"),

    ("15. Notifier<br/>Telegram Bot API, Resend",
     "After the alert is written",
     "Alert HTML and the chat ID or email address",
     "alert_key = show_id | alert_type | channel | change_ref, unique in Postgres",
     "The row is claimed BEFORE sending, so the unique constraint is the lock: two overlapping scans cannot both send. Email is claimed separately",
     "—",
     "Telegram message, optional email, and an alerts row with delivery status"),

    ("16. Early-bird reminder",
     "Every scan",
     "Shows whose early-bird deadline falls within 24 h",
     "Only while the status is still 'open'; the deadline itself is the change_ref",
     "Finds due shows and routes them through the alert writer; a moved deadline may alert again, an unchanged one cannot",
     "Gemini Flash — <b>alert</b>",
     "One reminder per deadline"),

    ("17. Artist suggestions<br/>Gemini",
     "Admin presses Suggest artists",
     "Every followed artist, starred ones weighted first",
     "Spotify's own recommendations API is closed to apps created after Nov 2024, so this uses the same model as the pipeline",
     "Suggests similar artists likely to play India, excluding anyone already followed; images looked up in the Spotify catalogue",
     "Gemini Flash — <b>suggest</b>",
     "artist_suggestions rows with Add and Dismiss actions"),

    ("18. Database<br/>Postgres on Neon",
     "Every stage",
     "Reads and writes from the whole pipeline",
     "Drizzle ORM with SQL migrations; all timestamps stored in UTC",
     "Tables: users, artists, scan_runs, source_items, shows, alerts, ai_calls, artist_suggestions, rejections. Uniqueness enforced on url_hash, dedup_key and alert_key",
     "—",
     "The single source of truth for every page"),

    ("19. Web app<br/>Next.js pages",
     "A request from the browser",
     "Query parameters for city, priority, month and reason",
     "Every page renders live rows; times displayed in Asia/Kolkata",
     "Dashboard, calendar, artists, filtered-out, alerts, scan log and how-it-works, all read from Postgres on each request",
     "—",
     "The rendered interface"),

    ("20. Access control",
     "Any page request; any admin action",
     "Admin password, or a bearer token for the schedulers",
     "Session cookie stores a hash of the password, never the password",
     "Middleware gates every page and redirects to /admin; /api/scan keeps its own bearer check so a scheduler fails loudly instead of following a redirect",
     "—",
     "An admin session, or a redirect to sign in"),
]


def para(text, style=cell):
    return Paragraph(text, style)


def build():
    doc = SimpleDocTemplate(
        OUT, pagesize=landscape(A3),
        leftMargin=11 * mm, rightMargin=11 * mm,
        topMargin=9 * mm, bottomMargin=9 * mm,
        title="Live Show Radar — Components Map",
        author="Live Show Radar",
    )

    story = [
        para("Live Show Radar — Components Map", title),
        para(
            "An AI-powered live-show alert system for one user in Bengaluru. It monitors concert "
            "and festival announcements across India for every artist he follows and alerts him "
            "when one appears, with early-bird ticket windows called out first. "
            "Every AI step runs on Google Gemini Flash through the official @google/genai SDK; no "
            "other model is used anywhere. Live at live-show-radar-pink.vercel.app",
            sub),
        Spacer(1, 7),
    ]

    data = [[para(c, head) for c in COLS]]
    for row in ROWS:
        actor, trigger, inp, ctx, proc, ai, out = row
        data.append([
            para(actor, cell_b),
            para(trigger),
            para(inp),
            para(ctx),
            para(proc),
            para(ai, cell_ai if ai != "—" else cell),
            para(out),
        ])

    widths = [46, 46, 54, 62, 78, 34, 50]
    total = sum(widths)
    avail = landscape(A3)[0] - 22 * mm
    widths = [w / total * avail for w in widths]

    table = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, HEAD),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    table.setStyle(TableStyle(style))
    story.append(table)

    story.append(Spacer(1, 6))
    story.append(KeepTogether([
        para("Notes", h2),
        para(
            "<b>Live data only.</b> No show is hard-coded or mocked. The single piece of seeded "
            "data is the starting artist list; every show on the dashboard was found at runtime.",
            note),
        Spacer(1, 2),
        para(
            "<b>Division of labour.</b> The model judges language — is this a real show, by this "
            "artist, in India. Code decides consequences — priority, deduplication, scheduling and "
            "whether to send. Priority is never set by the model.",
            note),
        Spacer(1, 2),
        para(
            "<b>Failure is contained.</b> A failure in one source, one artist or one AI call is "
            "recorded against the scan run and never fails the run. Invalid model output is "
            "retried once, then logged and skipped.",
            note),
        Spacer(1, 2),
        para(
            "<b>Observability.</b> Every Gemini call is logged to ai_calls with task, model, "
            "latency and token counts. Every refused candidate is kept in rejections with the "
            "quote it was judged on.",
            note),
    ]))

    doc.build(story)
    print("wrote", OUT)


build()
