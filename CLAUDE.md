# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

Run all commands from the **repository root** unless noted.

```bash
npm run dev          # Start client (port 3000) + server (port 3001) concurrently
npm run build        # Build client (tsc + Vite) and server (tsc + copy schema.sql)
npm run lint         # ESLint on client/src and server/src

# DB (run from root with --workspace=server)
npm run db:migrate --workspace=server   # Apply schema migrations
npm run db:seed --workspace=server      # Seed initial data
npm run db:seed-full --workspace=server # Full demo dataset

# ML agent (from root with --workspace=server)
npm run ml:agent --workspace=server          # Run ML agent in human-readable mode
npm run ml:agent:json --workspace=server     # Run ML agent with JSON output
```

Health check: `http://localhost:3001/health` — shows DB connectivity and env var status.

**No test suite exists.** There is no Jest, Vitest, or test runner configured.

---

## Architecture

### Monorepo layout

Two npm workspaces: `client/` (React, Vite, port 3000) and `server/` (Express, port 3001). The root `package.json` orchestrates them with `concurrently`. In dev, Vite proxies all `/api/*` requests to `localhost:3001`. In production, Vercel rewrites `/api/*` to the Render backend (`machliphon.onrender.com`).

### Multi-tenancy

Every resource is scoped to an **authority** (`authority_id` UUID). Users, kindergartens, substitutes, and all operational tables carry this column. The `authenticate` middleware attaches `req.user` (with `authority_id`) by querying the DB on every request — not just decoding the JWT payload. The `requireSameAuthority` middleware enforces cross-authority isolation; `super_admin` bypasses it.

### User roles

Four roles with escalating permissions: `substitute` → `manager` → `authority_admin` → `super_admin`. Role-gating on the backend uses `requireRole(...roles)` middleware. On the frontend, `ProtectedRoute` accepts an `allowedRoles` prop; `SmartDashboard` in `App.tsx` renders different dashboard components based on `user.role`.

### Frontend data flow

- **Auth state** — Zustand store (`context/authStore.ts`) persisted to `localStorage` under key `machliphon-auth`. Holds `user`, `token`, `refreshToken`.
- **Server state** — React Query v5 with a 1-minute stale time and 1 retry. All queries go through the Axios instance in `utils/api.ts`.
- **Token refresh** — The Axios response interceptor in `api.ts` automatically retries a 401 with a fresh token from `/auth/refresh`. It only clears auth (localStorage wipe + logout) when the refresh endpoint itself returns 401/403. Network errors and timeouts during refresh leave auth intact.
- **Error handling** — `getErrorMessage` / `handleApiError` in `utils/api.ts` extract the Hebrew `error` field from structured server responses. Use `handleApiError(err, 'context')` in catch blocks to show a toast and log debug info.

### Backend request lifecycle

```
Request
  → requestIdMiddleware (adds x-request-id header)
  → helmet / cors / rateLimit
  → authenticate (JWT verify + DB user lookup → req.user)
  → requireRole / requireSameAuthority (if applied to route)
  → asyncHandler(routeHandler)  ← all route handlers are wrapped
  → AppError thrown → errorHandler middleware → JSON response
```

All route handlers must be wrapped with `asyncHandler` from `middleware/asyncHandler.ts` — otherwise unhandled promise rejections will not reach the error handler.

### Error system

Throw typed subclasses of `AppError` from `errors/AppError.ts`:

| Class | HTTP | Default code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `AUTH_ERROR` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `DatabaseError` | 500 | `DB_ERROR` |

Constructor signature: `(userMessage: string /* Hebrew */, debugInfo: { source, detail, meta? })`.

The `errorHandler` middleware sends `{ error: userMessage, errorCode, requestId, debug }` — the `debug` field is only populated outside production.

### Database

Schema source of truth: `server/src/db/schema.sql`. The server auto-runs migrations and auto-seeds via `seed-full` when the `users` table is empty at startup. All primary keys are UUIDs (`uuid-ossp`). Use parameterized queries via the `query` function from `db/pool.ts` — never string-concatenate SQL.

Key relationships:
- `users` ←→ `substitutes` (1:1 via `user_id`)
- `users` ←→ `managers` (1:1 via `user_id`)
- `managers` ←→ `kindergartens` (many:many via `manager_kindergartens`)
- `absence_reports` → `assignments` → `substitutes` (the core workflow)
- `substitute_availability` tracks day-level opt-out; `known_absences` tracks pre-planned employee absences

### ML layer (`server/src/ml/`)

Pure TypeScript, no external ML runtime. Three model kinds stored as JSONB in `ml_models` (one row per `authority_id + kind`):

| Kind | What it does |
|---|---|
| `match` | Logistic regression: ranks substitute candidates for a (kindergarten, date) pair |
| `no_show` | Logistic regression: predicts no-show probability for a confirmed assignment |
| `demand` | Demand forecasting (absence volume per date) |

`recommender.ts` is the main entry point for match scoring. Cold-start (< 10 training samples) uses hand-tuned prior weights. All reasons returned in Hebrew. Models are re-trained on demand via `POST /api/ml/train`.

### Styling

Tailwind CSS 3 with three custom color tokens: `navy` (dark blues, UI chrome), `mint` (primary actions, success), `sky` (links, info). Font is Heebo everywhere. All user-facing strings are in Hebrew; `dir="rtl"` and `lang="he"` are set in `index.html`. Use `rtl:` Tailwind variants for directional adjustments.

---

## Key conventions

- **Strict TypeScript** — both tsconfigs use `strict: true`. Do not use `any`; use `unknown` and narrow.
- **Validation** — use Zod at route boundaries for request body validation.
- **Icons** — Lucide React only; do not add other icon libraries.
- **Charts** — Recharts (already installed).
- **Dates** — `date-fns`. Israeli holidays in `utils/holidays.ts`.
- **Notifications** — `react-hot-toast`; use `handleApiError` for API errors rather than calling `toast.error` directly.
- **Path alias** — `@/` maps to `client/src/`; use it for all internal imports.

---

## Environment variables (`server/.env`)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `JWT_SECRET` | Required in production; auto-generated randomly in dev (tokens invalidate on restart) |
| `PORT` | Defaults to 3001 |
| `NODE_ENV` | `development` / `production` |
| `CLIENT_URL` | Primary CORS origin in production (Vercel URL) |
| `ALLOWED_ORIGINS` | Comma-separated additional CORS origins |

Any Vercel preview URL matching `https://machliphon*.vercel.app` is automatically allowed in production CORS without env changes.

---

## Demo accounts (password: `Demo1234!`)

| Role | Email |
|---|---|
| `authority_admin` | director@yokneam.muni.il |
| `manager` | manager@yokneam.muni.il |
| `substitute` | miriam@example.com |

---

## Deployment

| Layer | Service | Config |
|---|---|---|
| Frontend | Vercel | `vercel.json` — static build from `client/`, rewrites `/api/*` to Render |
| Backend | Render | `railway.json` — NIXPACKS build, `npm run start --workspace=server` |
| Database | Render (PostgreSQL 15) | Attached to backend service |

No CI/CD pipelines — deploys trigger on push to the configured branch.
