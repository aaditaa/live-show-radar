"""Components map: two landscape A3 pages of colour-coded boxes and arrows."""
import math
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

OUT = "/Users/aaditaavashisht/code/live-show-radar/docs/components-map.pdf"
W, H = landscape(A3)

INK    = colors.HexColor("#1b2130")
HEADBG = colors.HexColor("#273449")
GRID   = colors.HexColor("#d7dee9")
BANDA  = colors.HexColor("#ffffff")
BANDB  = colors.HexColor("#f7f9fc")
MUTED  = colors.HexColor("#5d6878")
ACCENT = colors.HexColor("#c2410c")

AI     = (colors.HexColor("#ece5fb"), colors.HexColor("#b8a4ec"))
SYSTEM = (colors.HexColor("#dde9f8"), colors.HexColor("#9dbde3"))
OUTPUT = (colors.HexColor("#d9efdd"), colors.HexColor("#8dc79a"))
HUMAN  = (colors.HexColor("#fcecd2"), colors.HexColor("#e3bd78"))
REJECT = (colors.HexColor("#fbdcdc"), colors.HexColor("#e39a9a"))
PLAIN  = (colors.HexColor("#eef2f7"), colors.HexColor("#c3cedd"))

M = 22
COLS = ["Actor / Platform", "Trigger", "Input", "Context", "Processing", "AI", "Output"]
RAW_W = [138, 118, 140, 142, 150, 142, 178]
AVAIL = W - 2 * M
CW = [w / sum(RAW_W) * AVAIL for w in RAW_W]
CX, _x = [], M
for w in CW:
    CX.append(_x)
    _x += w

TITLE_H, HEAD_H, DEPLOY_H = 42, 22, 38

c = canvas.Canvas(OUT, pagesize=landscape(A3))
c.setTitle("Live Show Radar - Components Map")


def wrap(text, font, size, maxw):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if stringWidth(trial, font, size) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def box(x, y, w, h, palette, title, body=None, ts=7.3, bs=6.4):
    fill, stroke = palette
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
    pad = 5
    tl = wrap(title, "Helvetica-Bold", ts, w - 2 * pad)
    bl = wrap(body, "Helvetica", bs, w - 2 * pad) if body else []
    total = len(tl) * (ts + 1.5) + len(bl) * (bs + 1.3)
    ty = y + h / 2 + total / 2 - ts
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", ts)
    for line in tl:
        c.drawCentredString(x + w / 2, ty, line)
        ty -= ts + 1.5
    c.setFillColor(MUTED)
    c.setFont("Helvetica", bs)
    for line in bl:
        c.drawCentredString(x + w / 2, ty, line)
        ty -= bs + 1.3


def arrow(x1, y1, x2, y2, dashed=False):
    col = colors.HexColor("#6b7686")
    c.setStrokeColor(col)
    c.setLineWidth(0.9)
    c.setDash([2.2, 2.2] if dashed else [])
    c.line(x1, y1, x2, y2)
    c.setDash([])
    ang = math.atan2(y2 - y1, x2 - x1)
    s = 4.2
    c.setFillColor(col)
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2 - s * math.cos(ang - 0.42), y2 - s * math.sin(ang - 0.42))
    p.lineTo(x2 - s * math.cos(ang + 0.42), y2 - s * math.sin(ang + 0.42))
    p.close()
    c.drawPath(p, fill=1, stroke=0)


PAGE1 = [
    (("Schedulers", "GitHub Actions + Vercel Cron"), 44, [
        (PLAIN, "Every 30 minutes", "Vercel daily cron 08:00 IST as backup"),
        None,
        (PLAIN, "CRON_SECRET", "repo secret + Vercel env"),
        (SYSTEM, "POST /api/scan", "bearer token; fails the step on non-2xx"),
        None,
        (OUTPUT, "Scan run opened", "scan_runs row"),
    ]),
    (("Scan orchestrator", "Next.js route on Vercel"), 52, [
        (PLAIN, "GET or POST /api/scan", "bearer, or an admin session"),
        (PLAIN, "Artists due now", "15 max, starred first"),
        (PLAIN, "300 s function ceiling", "bounded batch keeps runs seconds long"),
        (SYSTEM, "Fan out, then close the run", "counts + per-source errors recorded"),
        None,
        (OUTPUT, "Rechecked in 2 h or 6 h", "starred / everyone else; JSON summary"),
    ]),
    (("Per-artist sources", "Google News RSS - Tavily - Gemini"), 50, [
        (PLAIN, "Scan opens", None),
        (PLAIN, "Every name and alias", "one query each"),
        (PLAIN, "when:14d, India feed", "Tavily for starred and new artists"),
        (SYSTEM, "Fetch in parallel", "concurrency 5, 10 s timeout, 429 backoff"),
        (AI, "Grounded search", "optional, starred only"),
        (OUTPUT, "Items tied to an artist", None),
    ]),
    (("Platform sweep", "Tavily, artist-agnostic"), 50, [
        (PLAIN, "6 h since the last", None),
        (PLAIN, "Four broad queries", "new concerts, early bird, festivals"),
        (PLAIN, "include_answer: false", "District, BookMyShow, Skillbox, +2"),
        (SYSTEM, "Search without an artist", "stored with artist_id null"),
        (AI, "Match to the whole list", "finds shows nobody searched for"),
        (OUTPUT, "Items for any artist", None),
    ]),
    (("Filter", "Deduplication"), 44, [
        (PLAIN, "Items fetched", None),
        (PLAIN, "All items this scan", None),
        (PLAIN, "url_hash unique key", "all previous scans; 30-day limit"),
        (SYSTEM, "Canonicalise + SHA-256", "drop duplicates and stale items"),
        None,
        (OUTPUT, "source_items", "only new items continue"),
    ]),
    (("Show extractor", "Gemini Task 1"), 50, [
        (PLAIN, "Unprocessed items", None),
        (PLAIN, "Artist + aliases", "up to 25 items per call"),
        (PLAIN, "Appendix B JSON schema", "today's date; full artist list"),
        (SYSTEM, "Structured output", "Zod validated, one retry, then skip"),
        (AI, "Extract candidates", "reports near misses honestly"),
        (OUTPUT, "Show candidates", "evidence quote + source URL"),
    ]),
    (("Triage + matcher", "Rules in code"), 46, [
        (PLAIN, "After extraction", None),
        (PLAIN, "Show candidates", None),
        (PLAIN, "Keep rules", "India, confidence 0.7+, upcoming"),
        (SYSTEM, "Build dedup_key", "artist | normalised city | date"),
        None,
        (OUTPUT, "Accepted", "new show, or an existing match"),
    ]),
    (("Rejection log", "What it refused"), 46, [
        (PLAIN, "A candidate fails", None),
        (PLAIN, "Candidate + reason", None),
        (PLAIN, "Six reasons", "not India, tribute, namesake, past"),
        (SYSTEM, "Store the evidence", "the quote it was judged on"),
        None,
        (REJECT, "rejections", "shown on /filtered, never alerted"),
    ]),
    (("Reconciler", "Gemini Task 2"), 46, [
        (PLAIN, "dedup_key already exists", None),
        (PLAIN, "Stored show + candidate", None),
        (PLAIN, "Null means unreported", "never cleared"),
        (SYSTEM, "Merge stated fields only", None),
        (AI, "Same show? changed?", "one material change"),
        (OUTPUT, "Show updated", "flagged when worth an alert"),
    ]),
    (("Prioritiser + writer", "Rules in code + Gemini Task 3"), 50, [
        (PLAIN, "New show or change", None),
        (PLAIN, "City, confidence, early bird", None),
        (PLAIN, "P0 Bengaluru + early bird", "P1 / P2 / P3 by rule"),
        (SYSTEM, "Priority set in code", "the model never sets it"),
        (AI, "Write the alert", "600 visible chars, explains priority"),
        (OUTPUT, "Alert ready", "P3 stops here: dashboard only"),
    ]),
    (("Early-bird reminder", "Every scan"), 46, [
        (PLAIN, "Deadline within 24 h", "while the status is still open"),
        (PLAIN, "The show + its deadline", None),
        (PLAIN, "Deadline is the change_ref", "a moved deadline may alert again"),
        (SYSTEM, "Route to the alert writer", None),
        (AI, "Write the reminder", "Gemini Task 3"),
        (OUTPUT, "One reminder per deadline", None),
    ]),
    (("Notifier", "Telegram Bot API - Resend"), 46, [
        (PLAIN, "Alert written", None),
        (PLAIN, "HTML + chat ID or email", None),
        (PLAIN, "alert_key unique in Postgres", "show | type | channel | change"),
        (SYSTEM, "Claim the row, then send", "the constraint is the lock"),
        None,
        (OUTPUT, "Karan is alerted", "alerts row with delivery status"),
    ]),
    (("Karan", "Bengaluru"), 40, [
        (PLAIN, "Phone buzzes", None),
        (PLAIN, "[BUY TODAY] ...", None),
        None,
        (HUMAN, "Reads and decides", None),
        None,
        (HUMAN, "Buys the early bird", "before the window closes"),
    ]),
]

PAGE2 = [
    (("Artist sync", "Spotify Web API"), 62, [
        (PLAIN, "Daily Vercel cron", "or Sync Spotify in the admin UI"),
        (PLAIN, "GET /me/following", "type=artist, limit=50, cursor-paginated"),
        (PLAIN, "OAuth, scope user-follow-read", "tokens server-side and refreshed; dev mode allows 5 users"),
        (SYSTEM, "Insert, reactivate, retire", "unfollowed artists deactivated, never deleted; manual artists untouched"),
        None,
        (OUTPUT, "artists, source spotify", "name and artwork"),
    ]),
    (("Artist search and import", "Spotify catalogue - CSV"), 62, [
        (HUMAN, "Admin types a name", "or pastes a list / imports CSV"),
        (PLAIN, "Free text, 2+ characters", "or one name per line with aliases"),
        (PLAIN, "App-level token", "existing list flags duplicates; works with no Spotify at all"),
        (SYSTEM, "Debounced search", "stale responses discarded; conservative name match for artwork"),
        None,
        (OUTPUT, "artists, source manual", "scanned exactly like Spotify ones"),
    ]),
    (("Artist suggestions", "Gemini"), 62, [
        (HUMAN, "Admin presses Suggest", None),
        (PLAIN, "Everyone followed", "starred weighted first"),
        (PLAIN, "Spotify recommendations API", "closed to apps created after Nov 2024, so Gemini does this"),
        (SYSTEM, "Exclude the known", "artwork looked up in the catalogue"),
        (AI, "Suggest similar artists", "likely to play India"),
        (OUTPUT, "artist_suggestions", "Add or Dismiss on /artists"),
    ]),
    (("Database", "Postgres on Neon"), 62, [
        (PLAIN, "Every stage", None),
        (PLAIN, "Reads and writes", "from the whole pipeline"),
        (PLAIN, "Drizzle ORM, SQL migrations", "all timestamps stored in UTC"),
        (SYSTEM, "Nine tables", "users, artists, scan_runs, source_items, shows, alerts, ai_calls, suggestions, rejections"),
        None,
        (OUTPUT, "One source of truth", "uniqueness on url_hash, dedup_key, alert_key"),
    ]),
    (("Dashboard and logs", "Next.js pages"), 62, [
        (PLAIN, "A request from the browser", None),
        (PLAIN, "City, priority, month, reason", "as query parameters"),
        (PLAIN, "Live rows on every request", "times shown in Asia/Kolkata"),
        (SYSTEM, "Seven pages", "dashboard, calendar, artists, filtered, alerts, scans, how it works"),
        None,
        (OUTPUT, "The interface", "every AI call and refusal visible"),
    ]),
    (("Access control", "Admin password"), 62, [
        (PLAIN, "Any page or admin action", None),
        (PLAIN, "ADMIN_PASSWORD", "or a bearer token for the schedulers"),
        (PLAIN, "Cookie holds a hash", "never the password itself"),
        (SYSTEM, "Middleware gates every page", "/api/scan keeps its own bearer check so a scheduler fails loudly"),
        None,
        (OUTPUT, "A session, or /admin", "sign-in page"),
    ]),
]


def render(rows, page_no, page_total, subtitle, deploy=False):
    top = H - M
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(M, top - 14, "Live Show Radar")
    c.setFont("Helvetica", 18)
    off = stringWidth("Live Show Radar", "Helvetica-Bold", 18) + 7
    c.drawString(M + off, top - 14, "·  Components map")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.6)
    c.drawString(M, top - 27, subtitle)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(W - M, top - 13, "live-show-radar-pink.vercel.app")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawRightString(W - M, top - 25,
                      "All AI on gemini-3.8-flash via @google/genai  -  no other model anywhere")
    c.drawRightString(W - M, top - 35, f"Page {page_no} of {page_total}")

    y = top - TITLE_H
    c.setFillColor(HEADBG)
    c.roundRect(M, y - HEAD_H, AVAIL, HEAD_H, 3, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.4)
    for i, name in enumerate(COLS):
        c.drawCentredString(CX[i] + CW[i] / 2, y - HEAD_H + 7.4, name)
    y -= HEAD_H

    for idx, ((actor, actor_sub), rh, cells) in enumerate(rows):
        ybot = y - rh
        c.setFillColor(BANDA if idx % 2 == 0 else BANDB)
        c.rect(M, ybot, AVAIL, rh, fill=1, stroke=0)
        c.setStrokeColor(GRID)
        c.setLineWidth(0.4)
        c.line(M, ybot, M + AVAIL, ybot)

        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(CX[0] + 8, ybot + rh / 2 + 1.5, actor)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.7)
        for j, line in enumerate(wrap(actor_sub, "Helvetica", 6.7, CW[0] - 14)):
            c.drawString(CX[0] + 8, ybot + rh / 2 - 8 - j * 7.8, line)

        placed = []
        for i, cell in enumerate(cells, start=1):
            if cell is None:
                placed.append(None)
                continue
            pal, t, b = cell
            bx, by, bw, bh = CX[i] + 8, ybot + 7, CW[i] - 16, rh - 14
            box(bx, by, bw, bh, pal, t, b)
            placed.append((bx, by, bw, bh))

        for i in range(len(placed) - 1):
            a, b2 = placed[i], placed[i + 1]
            if not a or not b2 or b2[0] - (a[0] + a[2]) < 3:
                continue
            arrow(a[0] + a[2] + 1.5, a[1] + a[3] / 2, b2[0] - 2, b2[1] + b2[3] / 2)
        y = ybot

    if deploy:
        dy = y - 8
        c.setFillColor(colors.HexColor("#f2f5fa"))
        c.setStrokeColor(GRID)
        c.setLineWidth(0.6)
        c.roundRect(M, dy - DEPLOY_H, AVAIL, DEPLOY_H, 4, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.3)
        c.drawString(M + 12, dy - 17, "Deployment")
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.7)
        c.drawString(M + 12, dy - 27, "code to production")
        chain = [
            (SYSTEM, "GitHub", "repository + Actions cron"),
            (SYSTEM, "Vercel", "Next.js 16, 300 s ceiling"),
            (SYSTEM, "Neon Postgres", "Drizzle migrations"),
            (OUTPUT, "Live app", "scans every 30 min"),
        ]
        cw, gap, sx = 150, 34, M + 150
        for i, (pal, t, b) in enumerate(chain):
            bx = sx + i * (cw + gap)
            box(bx, dy - DEPLOY_H + 6, cw, DEPLOY_H - 12, pal, t, b)
            if i:
                arrow(bx - gap + 2, dy - DEPLOY_H / 2, bx - 3, dy - DEPLOY_H / 2)
        y = dy - DEPLOY_H

    ly = y - 15
    items = [(AI, "AI component"), (SYSTEM, "System step"), (OUTPUT, "Output"),
             (HUMAN, "Human step"), (REJECT, "Refused / not alerted"), (PLAIN, "Context")]
    lx = M
    for (fill, stroke), label in items:
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.7)
        c.roundRect(lx, ly - 7, 15, 9, 2, fill=1, stroke=1)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7)
        c.drawString(lx + 20, ly - 5, f"= {label}")
        lx += 20 + stringWidth(f"= {label}", "Helvetica", 7) + 22
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawRightString(W - M, ly - 5,
                      "Priority is decided in code, never by the model. "
                      "The model judges language; code decides consequences.")
    c.showPage()


render(PAGE1, 1, 2,
       "Finding a show and alerting. No show is hard-coded: every one is discovered at runtime "
       "from live sources, then filtered, prioritised and sent.")
render(PAGE2, 2, 2,
       "Artists, data and operations. How the watch list is built and kept, where everything is "
       "stored, and who is allowed to see it.", deploy=True)
c.save()
print("wrote", OUT)
