"""Components map as a flow diagram: boxes per column, arrows for the flow."""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

OUT = "/Users/aaditaavashisht/code/live-show-radar/docs/components-map.pdf"
W, H = landscape(A3)

INK      = colors.HexColor("#1b2130")
HEADBG   = colors.HexColor("#273449")
GRID     = colors.HexColor("#d7dee9")
BANDA    = colors.HexColor("#ffffff")
BANDB    = colors.HexColor("#f7f9fc")
MUTED    = colors.HexColor("#5d6878")

AI       = (colors.HexColor("#ece5fb"), colors.HexColor("#b8a4ec"))
SYSTEM   = (colors.HexColor("#dde9f8"), colors.HexColor("#9dbde3"))
OUTPUT   = (colors.HexColor("#d9efdd"), colors.HexColor("#8dc79a"))
HUMAN    = (colors.HexColor("#fcecd2"), colors.HexColor("#e3bd78"))
REJECT   = (colors.HexColor("#fbdcdc"), colors.HexColor("#e39a9a"))
PLAIN    = (colors.HexColor("#eef2f7"), colors.HexColor("#c3cedd"))

M = 22
COLS = ["Actor / Platform", "Trigger", "Input", "Context", "Processing", "AI", "Output"]
RAW_W = [138, 118, 140, 142, 150, 142, 178]
AVAIL = W - 2 * M
CW = [w / sum(RAW_W) * AVAIL for w in RAW_W]
CX = []
_x = M
for w in CW:
    CX.append(_x)
    _x += w

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


def box(cx, cy, w, h, palette, title, body=None, bold_size=7.4, body_size=6.6):
    fill, stroke = palette
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(cx, cy, w, h, 4, fill=1, stroke=1)

    pad = 5
    tlines = wrap(title, "Helvetica-Bold", bold_size, w - 2 * pad)
    blines = wrap(body, "Helvetica", body_size, w - 2 * pad) if body else []
    total = len(tlines) * (bold_size + 1.6) + len(blines) * (body_size + 1.4)
    y = cy + h / 2 + total / 2 - bold_size

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", bold_size)
    for line in tlines:
        c.drawCentredString(cx + w / 2, y, line)
        y -= bold_size + 1.6
    c.setFillColor(MUTED)
    c.setFont("Helvetica", body_size)
    for line in blines:
        c.drawCentredString(cx + w / 2, y, line)
        y -= body_size + 1.4


def arrow(x1, y1, x2, y2, dashed=False, colour=None):
    c.setStrokeColor(colour or colors.HexColor("#6b7686"))
    c.setLineWidth(0.9)
    c.setDash([2.2, 2.2] if dashed else [])
    c.line(x1, y1, x2, y2)
    c.setDash([])
    # Head, oriented along the segment.
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 4.2
    c.setFillColor(colour or colors.HexColor("#6b7686"))
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2 - size * math.cos(ang - 0.42), y2 - size * math.sin(ang - 0.42))
    p.lineTo(x2 - size * math.cos(ang + 0.42), y2 - size * math.sin(ang + 0.42))
    p.close()
    c.drawPath(p, fill=1, stroke=0)


# actor(title, sub), then one entry per column 1..6: None or (palette, title, body)
ROWS = [
    (("Schedulers", "GitHub Actions + Vercel Cron"), 54, [
        (PLAIN, "Every 30 minutes", "daily cron as backup"),
        None,
        (PLAIN, "CRON_SECRET", "repo + Vercel secret"),
        (SYSTEM, "POST /api/scan", "bearer token, fails on non-2xx"),
        None,
        (OUTPUT, "Scan run opened", "scan_runs row"),
    ]),
    (("Sources", "Google News - Tavily - Gemini"), 64, [
        (PLAIN, "Scan opens", None),
        (PLAIN, "15 due artists", "names + aliases, starred first"),
        (PLAIN, "14-day window", "5 Indian ticketing sites; 6 h sweep gap"),
        (SYSTEM, "Fetch in parallel", "concurrency 5, 10 s timeout each"),
        (AI, "Grounded search", "optional, starred only"),
        (OUTPUT, "Normalised items", "{source, url, title, snippet, date}"),
    ]),
    (("Filter", "Deduplication"), 54, [
        (PLAIN, "Items fetched", None),
        (PLAIN, "All items this scan", None),
        (PLAIN, "url_hash index", "all previous scans; 30-day limit"),
        (SYSTEM, "Canonicalise + SHA-256", "drop duplicates and stale items"),
        None,
        (OUTPUT, "source_items", "only genuinely new items continue"),
    ]),
    (("Show extractor", "Gemini Task 1"), 64, [
        (PLAIN, "Unprocessed items", None),
        (PLAIN, "Artist + aliases", "up to 25 items per call"),
        (PLAIN, "Appendix B schema", "today's date; full artist list"),
        (SYSTEM, "Structured output", "Zod validated, one retry"),
        (AI, "Extract candidates", "reports near misses honestly"),
        (OUTPUT, "Show candidates", "with evidence quote + source URL"),
    ]),
    (("Triage + matcher", "Rules in code"), 68, [
        (PLAIN, "After extraction", None),
        (PLAIN, "Show candidates", None),
        (PLAIN, "Keep rules", "India, confidence 0.7+, upcoming"),
        (SYSTEM, "Build dedup_key", "artist | city | date"),
        None,
        (OUTPUT, "Accepted", "new show, or an existing match"),
    ]),
    (("Rejection log", "What it refused"), 54, [
        (PLAIN, "A candidate fails", None),
        (PLAIN, "Candidate + reason", None),
        (PLAIN, "Six reasons", "not India, tribute, namesake, past"),
        (SYSTEM, "Store the evidence", "quote it was judged on"),
        None,
        (REJECT, "rejections", "shown on /filtered, never alerted"),
    ]),
    (("Reconciler", "Gemini Task 2"), 58, [
        (PLAIN, "dedup_key exists", None),
        (PLAIN, "Stored show + candidate", None),
        (PLAIN, "Null means unreported", "never cleared"),
        (SYSTEM, "Merge stated fields", None),
        (AI, "Same show? changed?", "one material change"),
        (OUTPUT, "Show updated", "flagged when worth an alert"),
    ]),
    (("Prioritiser + writer", "Rules in code + Gemini Task 3"), 68, [
        (PLAIN, "New show or change", None),
        (PLAIN, "City, confidence, early bird", None),
        (PLAIN, "P0 Bengaluru + early bird", "P1 / P2 / P3 by rule"),
        (SYSTEM, "Priority set in code", "the model never sets it"),
        (AI, "Write the alert", "600 visible chars, explains priority"),
        (OUTPUT, "Alert ready", "P3 stops here: dashboard only"),
    ]),
    (("Notifier", "Telegram Bot API - Resend"), 58, [
        (PLAIN, "Alert written", None),
        (PLAIN, "Message + chat ID", None),
        (PLAIN, "alert_key unique", "show | type | channel | change"),
        (SYSTEM, "Claim row, then send", "the lock is the constraint"),
        None,
        (OUTPUT, "Karan is alerted", "alerts row with delivery status"),
    ]),
    (("Karan", "Bengaluru"), 48, [
        (PLAIN, "Phone buzzes", None),
        (PLAIN, "[BUY TODAY] ...", None),
        None,
        (HUMAN, "Reads and decides", "ticket link in the message"),
        None,
        (HUMAN, "Buys the early bird", "before the window closes"),
    ]),
    (("Database + dashboard", "Neon Postgres - Next.js"), 54, [
        (PLAIN, "Every stage / a visit", None),
        (PLAIN, "Nine tables", None),
        (PLAIN, "UTC stored", "Asia/Kolkata displayed"),
        (SYSTEM, "Read live on request", None),
        None,
        (OUTPUT, "Dashboard, calendar, logs", "shows, alerts, scans, filtered"),
    ]),
]

TITLE_H = 44
HEAD_H = 22
DEPLOY_H = 44
LEGEND_H = 18

body_h = sum(r[1] for r in ROWS)
top = H - M

# ---- title -------------------------------------------------------------
c.setFillColor(INK)
c.setFont("Helvetica-Bold", 19)
c.drawString(M, top - 15, "Live Show Radar")
c.setFont("Helvetica", 19)
c.drawString(M + stringWidth("Live Show Radar", "Helvetica-Bold", 19) + 7, top - 15,
             "·  Components map")
c.setFillColor(MUTED)
c.setFont("Helvetica", 7.8)
c.drawString(M, top - 29,
             "Concert and festival alerts for India. Every AI step runs on Google Gemini Flash "
             "through the official @google/genai SDK; no other model is used anywhere.")
c.setFont("Helvetica-Bold", 8)
c.setFillColor(colors.HexColor("#c2410c"))
c.drawRightString(W - M, top - 15, "live-show-radar-pink.vercel.app")
c.setFont("Helvetica", 7.2)
c.setFillColor(MUTED)
c.drawRightString(W - M, top - 28, "5 Gemini tasks  -  20 components  -  141 tests")

y = top - TITLE_H

# ---- column headers ----------------------------------------------------
c.setFillColor(HEADBG)
c.roundRect(M, y - HEAD_H, AVAIL, HEAD_H, 3, fill=1, stroke=0)
c.setFillColor(colors.white)
c.setFont("Helvetica-Bold", 8.4)
for i, name in enumerate(COLS):
    c.drawCentredString(CX[i] + CW[i] / 2, y - HEAD_H + 7.4, name)
y -= HEAD_H

# ---- rows --------------------------------------------------------------
for idx, ((actor, actor_sub), rh, cells) in enumerate(ROWS):
    ytop = y
    ybot = y - rh

    c.setFillColor(BANDA if idx % 2 == 0 else BANDB)
    c.rect(M, ybot, AVAIL, rh, fill=1, stroke=0)
    c.setStrokeColor(GRID)
    c.setLineWidth(0.4)
    c.line(M, ybot, M + AVAIL, ybot)

    # actor cell
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8.6)
    c.drawString(CX[0] + 8, ybot + rh / 2 + 1.5, actor)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.8)
    for j, line in enumerate(wrap(actor_sub, "Helvetica", 6.8, CW[0] - 14)):
        c.drawString(CX[0] + 8, ybot + rh / 2 - 8 - j * 8, line)

    placed = []
    for i, cell in enumerate(cells, start=1):
        if cell is None:
            placed.append(None)
            continue
        palette, ctitle, cbody = cell
        bw = CW[i] - 16
        bh = rh - 16
        bx = CX[i] + 8
        by = ybot + 8
        box(bx, by, bw, bh, palette, ctitle, cbody)
        placed.append((bx, by, bw, bh))

    # horizontal arrows between consecutive filled cells
    for i in range(len(placed) - 1):
        a, b = placed[i], placed[i + 1]
        if not a or not b:
            continue
        ax = a[0] + a[2]
        bx = b[0]
        if bx - ax < 3:
            continue
        arrow(ax + 1.5, a[1] + a[3] / 2, bx - 2, b[1] + b[3] / 2)

    y = ybot

# ---- deployment strip --------------------------------------------------
dy = y - 8
c.setFillColor(colors.HexColor("#f2f5fa"))
c.setStrokeColor(GRID)
c.setLineWidth(0.6)
c.roundRect(M, dy - DEPLOY_H, AVAIL, DEPLOY_H, 4, fill=1, stroke=1)
c.setFillColor(INK)
c.setFont("Helvetica-Bold", 8.4)
c.drawString(M + 12, dy - 18, "Deployment and scheduling")
c.setFillColor(MUTED)
c.setFont("Helvetica", 6.8)
c.drawString(M + 12, dy - 29, "code to production")

chain = [
    (SYSTEM, "GitHub", "repository + Actions cron"),
    (SYSTEM, "Vercel", "Next.js 16, 300 s ceiling"),
    (SYSTEM, "Neon Postgres", "Drizzle migrations"),
    (OUTPUT, "Live app", "scans every 30 min"),
]
cw = 150
gap = 34
startx = M + 150
for i, (pal, t, b) in enumerate(chain):
    bx = startx + i * (cw + gap)
    box(bx, dy - DEPLOY_H + 7, cw, DEPLOY_H - 14, pal, t, b)
    if i:
        arrow(bx - gap + 2, dy - DEPLOY_H / 2, bx - 3, dy - DEPLOY_H / 2)

# ---- legend ------------------------------------------------------------
ly = dy - DEPLOY_H - 15
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
                  "Priority is decided in code, never by the model. The model judges language; "
                  "code decides consequences.")

c.showPage()
c.save()
print("wrote", OUT)
