# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Tenttilex** — a Finnish legal document reader (SEB-compatible Finlex reader). It serves Finnish statutes (lainsäädäntö) and supreme court precedents (oikeuskäytäntö) in Finnish (`fin`) and Swedish (`swe`), sourced from [Finlex](https://finlex.fi). The app is deployed on OpenShift.

## Commands

All commands are run from the repo root unless noted.

### Setup
```bash
npm run setup          # install all dependencies (root + backend + frontend)
```

### Development
```bash
npm run dev:deps       # start Postgres + Typesense via Docker Compose (required for backend)
npm run seed           # seed/sync the database from Finlex (slow — fetches live data)
npm run dev            # start backend (port 3001) + frontend dev server (port 5173) concurrently
npm run dev:full       # dev:deps + seed + dev (full stack from scratch)
```

### Build (production)
```bash
npm --prefix ./frontend run build   # builds frontend and copies dist into backend/src/frontend/
npm --prefix ./backend run build    # compiles TypeScript to backend/dist/
npm --prefix ./backend start        # serve frontend + API from port 3001
```

### Testing
```bash
npm --prefix ./backend test         # backend unit tests (node:test + supertest, requires PG_URI env)
npm --prefix ./frontend test        # frontend unit tests (vitest)

# Run a single backend test file:
NODE_ENV=test tsx backend/test/app.test.ts

# E2E tests (Playwright, requires running app + deps):
npm --prefix ./backend run e2e

# E2E via Docker Compose (same as CI):
docker compose -f run_e2e.yaml up --build --exit-code-from playwright
```

### Lint
```bash
npm --prefix ./backend run lint        # show lint errors
npm --prefix ./backend run lint:fix    # auto-fix
npm --prefix ./frontend run lint
npm --prefix ./frontend run lint:fix
```

## Environment variables

Backend reads from `backend/.env` in development. Required variables:

| Variable | Description | Default |
|---|---|---|
| `PG_URI` | PostgreSQL connection string | — |
| `TYPESENSE_API_KEY` | Typesense API key | — |
| `TYPESENSE_HOST` | Typesense hostname | `localhost` |
| `TYPESENSE_PORT` | Typesense port | `8108` |
| `START_YEAR` | Earliest year to sync from Finlex | `1700` |
| `END_YEAR` | Latest year (defaults to current year) | — |
| `ADMIN_PASSWORD` | Password for the `/admin` UI | `admin` |
| `JWT_SECRET` | Secret for admin JWT tokens | — |
| `NODE_ENV` | `development` / `test` / `production` | — |

## Architecture

The app is a **monorepo** with three parts: `frontend/`, `backend/`, and shared Docker/OpenShift config.

### Backend (`backend/src/`)

Express 5 app on Node.js with TypeScript (compiled via `tsx` in dev, `tsc` for production).

**Data flow:**
1. `dbSetup.ts` — orchestrates the full sync: checks if Postgres is up-to-date vs Finlex, fills missing statutes/judgments, then re-indexes Typesense.
2. `db/load.ts` — fetches raw content from Finlex. Statutes come via the **Finlex open API** (XML/AkomaNtoso format). Judgments are **scraped** from Finlex HTML pages (there is no public API for them). Rate-limiting via Bottleneck (max 200 req/min).
3. `db/models/` — thin Postgres model layer (`statute.ts`, `judgment.ts`, `keyword.ts`, `commonName.ts`, `image.ts`, `status.ts`).
4. `search.ts` — syncs Postgres → Typesense. Creates four collections: `statutes_fin`, `statutes_swe`, `judgments_fin`, `judgments_swe`. Statutes are stored as XML; judgments as HTML. Before indexing, text is normalized (lowercased, punctuation stripped, stop-words removed via `util/dropwords.ts`).
5. `controllers/` — Express routers for `statute`, `judgment`, `keyword`, `judgmentKeyword`, `media`.
6. `app.ts` — assembles the Express app, mounts routers, defines admin endpoints (JWT-protected), serves the built frontend as static files from `src/frontend/`.

**Key language constants:** `fin` / `swe` (internal), `fi` / `sv` (Typesense locale), `kko` / `kho` (court level).

**Status tracking:** every long-running operation writes rows to a `status` table (with an `updating` boolean flag). `GET /api/check-db-status` is polled by the frontend on load — it returns 503 while an update is in progress.

### Frontend (`frontend/src/`)

React 19 + Vite + React Router 7 SPA. Built output is copied into `backend/src/frontend/` and served by Express.

**Routes:**
- `/lainsaadanto/` — statute search (`ListDocumentPage`)
- `/lainsaadanto/:year/:id` — statute document viewer (`DocumentPage`)
- `/lainsaadanto/:year` — statutes by year (`YearDocumentList`)
- `/lainsaadanto/asiasanat[/:keyword_id]` — keyword browse for statutes
- `/oikeuskaytanto` — judgment search
- `/oikeuskaytanto/:year/:id/:level` — judgment document viewer
- `/oikeuskaytanto/asiasanat[/:keyword_id]` — keyword browse for judgments
- `/admin` — admin panel (JWT login, DB sync trigger, Typesense rebuild)
- `/summary` — year-by-year document count overview

Language (`fin`/`swe`) is persisted in `localStorage` and passed down as a prop. The app polls `/api/check-db-status` on mount and shows a loading spinner while the DB is updating.

**Statute content** is rendered from AkomaNtoso XML using an XSL stylesheet (`public/akomo_ntoso.xsl`). **Judgment content** is rendered as sanitized HTML (scraped from Finlex).

### Infrastructure

- **Postgres** — primary store for statute/judgment content, keywords, common names, images.
- **Typesense** — full-text search index. Collections are rebuilt from Postgres via admin API or on startup if out of date.
- **Docker Compose** (`docker-compose.yml`) — local dev/CI stack (postgres + typesense + app).
- **OpenShift** manifests in `manifests/` (staging, production, production-test environments).
- **CI** via GitHub Actions (`.github/workflows/`): separate workflows for backend tests, frontend tests, and E2E tests.
- **Sentry** is wired into both frontend (`@sentry/react`) and backend (`@sentry/node`).
