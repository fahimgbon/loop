# Aceync (MVP)
Audio-first decision + backlog orchestration for small product teams.

This repo is a **Slack-first** MVP that acts as a **system-of-record** (canonical artifacts live in Aceync) and a **system-of-flow** (Slack/Calendar/Notion are capture + distribution surfaces).

## What’s included (so far)
- Workspaces + users (email/password) with cookie sessions
- Template-backed artifacts composed of typed blocks (Markdown content)
- Folder-based structure inheritance (new artifacts inherit folder block schema)
- Folder-level structure versioning + per-artifact sync prompts for block additions/removals
- Inbox for untriaged contributions
- Review requests + async feedback capture (text/audio responses)
- Search across artifacts + blocks
- Slack app endpoints (OAuth/events/commands/interactive) wired to the core model
- Google Workspace OAuth + calendar sync (Docs attached to events become meeting updates)
- Background job runner skeleton for transcription/classification (AI provider interface)

## Project structure
- `src/app` – Next.js App Router (UI + API routes)
- `src/server` – DB access, repositories, services, Slack + AI helpers
- `db/migrations` – SQL migrations applied by `npm run db:migrate`
- `scripts` – migrate/seed/worker entrypoints

## Requirements
- Node.js 20+ (tested with Node 24)
- Postgres 14+ (Docker optional)

## Quickstart
1. Create env file:
   - `cp .env.example .env.local`
   - set `SESSION_SECRET` (any long random string)
2. Start Postgres:
   - **macOS (beginner-friendly):** install + open Postgres.app, click “Initialize”, then ensure it’s running
   - **Homebrew:** `brew install postgresql@16` → `brew services start postgresql@16` → `createdb loop`
   - **Docker (optional):** `docker compose up -d db`
3. Install deps:
   - `npm install`
4. Run migrations + seed:
   - `npm run db:migrate`
   - `npm run db:seed`
5. Start app:
   - `npm run dev`
6. Open:
   - `http://localhost:3000`
7. Log in (seed defaults):
   - email: `admin@loop.local`
   - password: `admin`

## Folder-first workflow
- Create a folder at `/w/<workspace>/folders/new` from one of the starter structures:
  - Research question
  - Policy proposal
  - Startup idea
  - Project in an established organization (PRD)
- Or define your own custom block list.
- New artifacts created in a folder inherit that folder’s structure.
- If a folder structure changes later, existing artifacts in that folder show a sync prompt where users can choose to add missing blocks and/or delete extra blocks.

## Slack setup (MVP)
You’ll need a Slack app configured with:
- OAuth redirect URL: `${APP_BASE_URL}/api/slack/oauth/callback`
- Event subscription URL: `${APP_BASE_URL}/api/slack/events`
- Interactivity URL: `${APP_BASE_URL}/api/slack/interactive`
- Slash command request URL: `${APP_BASE_URL}/api/slack/commands`

Set env vars in `.env.local`:
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_STATE_SECRET`

Optional: use `docs/slack-manifest.example.yml` as a starting point (replace `${APP_BASE_URL}`).

Slash command surface (minimum):
- `/aceync note <text>` → saves a contribution
- `/aceync search <query>` → searches artifacts + blocks and returns links
- `/aceync recent` → shows recent artifacts and open review requests
- `/aceync record` → opens an Aceync capture flow for audio/video from Slack
- `/aceync request` → opens a modal to create a review request in the current channel
- Mention the app → `@Aceync search roadmap`, `@Aceync recent`, or `@Aceync record` works in-thread
- Share an Aceync artifact or review-request URL in Slack → auto-preview with Aceync context

## Google Workspace setup (Calendar + Docs)
You’ll need a Google Cloud OAuth app configured with:
- Authorized redirect URI: `${APP_BASE_URL}/api/google/oauth/callback`

Enable Google Calendar API + Google Drive API, then set env vars:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

After connecting in the Workspace → Integrations panel, set a default calendar ID (e.g. `primary`) and click **Sync now**. Aceync will scan recent events with Google Docs attached and turn them into structured updates.

## Scripts
- `npm run dev` – Next dev server
- `npm run db:migrate` – run SQL migrations
- `npm run db:seed` – seed dev workspace/user/templates
- `npm run worker` – background job runner (optional in dev; required if `INLINE_JOBS=0`)

## AI (transcription/classification)
Aceync uses a simple job queue (`jobs` table) processed by `npm run worker`.

- `AI_PROVIDER=mock` (default): writes mock transcripts + heuristic intent classification.
- `AI_PROVIDER=openai`: uses OpenAI for audio transcription (set `OPENAI_API_KEY`); intent classification still uses heuristics until prompts are locked.

### Dev convenience: inline jobs
You don’t need to run a separate worker in development: jobs run inline by default (or set `INLINE_JOBS=1`).
If you want a separate worker process, set `INLINE_JOBS=0` and run `npm run worker`.
