# Live Show Radar

An AI-powered live-show alert system for one user, Karan (home city Bengaluru). It monitors
concert and festival announcements in India for every artist he follows and alerts him the
moment a show is announced, with special attention to early-bird ticket windows.

> **Status: M1 complete.** Scaffold, database schema, migrations, seed and a dashboard that
> reads from the database. The full README (architecture, components map, data sources, AI
> tasks, deploy steps, known limitations) lands in M7.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Postgres on Neon (`@neondatabase/serverless`) + Drizzle ORM with SQL migrations
- Google Gemini Flash via `@google/genai` for all AI tasks — no other LLM anywhere in the app
- zod for validating every Gemini response, `fast-xml-parser` for RSS
- Telegram Bot API for alerts; Vitest for unit tests

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL and your keys
npm run db:migrate           # apply SQL migrations
npm run db:seed              # create Karan + the 20 demo artists
npm run dev                  # http://localhost:3000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run db:generate` | Generate a SQL migration from `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed Karan and the 20 demo artists (idempotent) |
| `npm run db:studio` | Drizzle Studio |

## Data

The only seeded data is the artist list. **No shows are ever hard-coded or mocked** — every
show on the dashboard comes from a live fetch against Google News RSS and the Tavily Search
API, extracted by Gemini.

All timestamps are stored in UTC and rendered in Asia/Kolkata.

## Secrets

Real values live in `.env.local`, which is git-ignored. `.env.example` lists every variable
name with no values. Nothing in this repo logs or prints a secret.
