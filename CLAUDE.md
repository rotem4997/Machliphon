# CLAUDE.md — Machliphon (מחליפון)

AI assistant reference for the Machliphon codebase. Read this before making changes.

---

## Project Overview

**Machliphon** (מחליפון) is a full-stack web application for managing substitute teachers (מחליפות) in Israeli kindergartens at the municipal authority level. The system serves three roles: authority-level managers, kindergarten managers, and substitute teachers themselves.

- **Language**: Hebrew (RTL) primary, with English in code/technical contexts
- **Stack**: React + TypeScript (frontend), Node.js + Express + TypeScript (backend), PostgreSQL 15
- **Architecture**: Monorepo with `client/` and `server/` workspaces

---

## Repository Structure

```
Machliphon/
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   │   ├── auth/         # ProtectedRoute.tsx
│   │   │   └── layout/       # AppLayout.tsx
│   │   ├── context/          # Zustand stores (authStore.ts)
│   │   ├── pages/            # Page-level components (one per route)
│   │   ├── utils/            # api.ts (Axios), holidays.ts (Israeli holidays)
│   │   └── styles/           # globals.css (Tailwind base)
│   ├── public/               # Static assets, manifest.json (PWA)
│   ├── index.html            # Entry HTML — Hebrew RTL, Heebo font
│   ├── vite.config.ts        # Vite config — dev proxy → port 3001
│   ├── tailwind.config.js    # Custom navy/mint/sky palette, RTL
│   └── tsconfig.json         # ES2020, path alias @/* → ./src/*
│
├── server/                   # Express backend
│   ├── src/
│   │   ├── db/               # pool.ts, schema.sql, migrate.ts, seed.ts, seed-demo.ts
│   │   ├── middleware/       # auth.ts (JWT), errorHandler.ts, asyncHandler.ts, requestId.ts
│   │   ├── routes/           # One file per resource (8 route files)
│   │   ├── errors/           # AppError.ts — structured error class
│   │   └── index.ts          # Express app entry, port 3001
│   └── tsconfig.json         # ES2020, CommonJS output, strict, sourcemaps
│
├── .claude/agents/           # 10 specialized Claude agent profiles
├── package.json              # Root monorepo — workspaces: ["client","server"]
├── vercel.json               # Frontend deploy (Vercel) + API proxy to Railway
├── railway.json              # Backend deploy (Railway) — NIXPACKS, PostgreSQL 15
└── README.md                 # Hebrew project docs with quick start
```

---

## Development Commands

Run all commands from the **repository root** unless noted.

| Command | What it does |
|---|---|
| `npm run dev` | Start both client (port 3000) and server (port 3001) concurrently |
| `npm run build` | Build client (tsc + Vite) and server (tsc + copy schema.sql) |
| `npm run start` | Run production server |
| `npm run lint` | ESLint on `client/src` and `server/src` |
| `npm run db:migrate --workspace=server` | Run DB migrations against `DATABASE_URL` |
| `npm run db:seed --workspace=server` | Seed initial data |
| `npm run db:seed-demo --workspace=server` | Seed demo accounts |

**No test suite exists.** Manual testing is required.

---

## Environment Variables

Create a `.env` file in `server/` (not committed). Required for development:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes (prod) | Auto-generated randomly in dev if missing — not safe for prod |
| `PORT` | No | Defaults to 3001 |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `CLIENT_URL` | No (prod) | Frontend URL for CORS allow-list in production |

> No `.env.example` file exists — reference this table and the README for setup.

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Authority Manager | (see README) | `Demo1234!` |
| Kindergarten Manager | (see README) | `Demo1234!` |
| Substitute | (see README) | `Demo1234!` |

---

## Architecture & Key Conventions

### Frontend

- **State management**: Zustand with persistence (`context/authStore.ts`). Only auth state lives in Zustand; server state uses React Query.
- **Data fetching**: React Query v5 (`@tanstack/react-query`). All API calls go through `utils/api.ts` (Axios instance with JWT interceptor).
- **Routing**: React Router v6. `ProtectedRoute` guards role-based access.
- **Styling**: Tailwind CSS 3 with custom color tokens (`navy`, `mint`, `sky`). RTL layout is the default. Use the established color palette — do not add arbitrary colors.
- **Path alias**: `@/` maps to `client/src/`. Use it for all internal imports.
- **Icons**: Lucide React. Do not add other icon libraries.
- **Notifications**: React Hot Toast (`react-hot-toast`). Use for user feedback.
- **Charts**: Recharts. Already installed — use for any new data visualizations.
- **Dates**: `date-fns`. Israeli holidays are handled in `utils/holidays.ts`.
- **PWA**: `manifest.json` is configured for Hebrew RTL standalone mode — do not break this.

### Backend

- **All routes** must be wrapped with `asyncHandler` from `middleware/asyncHandler.ts` to propagate async errors.
- **Error handling**: Throw `AppError` from `errors/AppError.ts` for expected errors. It carries HTTP status, a Hebrew user-facing message, and an English debug message. The centralized `errorHandler` middleware formats the response.
- **Authentication**: JWT via `middleware/auth.ts`. Attaches `req.user` with `{ id, role, authority_id }`. Protect all non-auth routes with this middleware.
- **Validation**: Use Zod for request body validation in routes.
- **Database**: All queries go through `db/pool.ts` (pg Pool). Use parameterized queries — never string-concatenate SQL.
- **IDs**: UUIDs everywhere (`uuid` package).
- **Passwords**: bcryptjs — never store plaintext.
- **Security headers**: Helmet is mounted globally — do not disable it.
- **Rate limiting**: `express-rate-limit` is active — keep it enabled.

### Database

- Schema is in `server/src/db/schema.sql` (257 lines). Read it before writing queries.
- Migrations run via `db/migrate.ts`. Add new migrations as numbered SQL files if the project evolves to that pattern.
- PostgreSQL 15 in production (Railway). Match syntax accordingly.

---

## API Structure

Base path: `/api`

| Prefix | Resource |
|---|---|
| `/api/auth` | Login, logout, token refresh |
| `/api/substitutes` | Substitute CRUD |
| `/api/assignments` | Assignment management |
| `/api/absences` | Absence tracking |
| `/api/dashboard` | Dashboard statistics |
| `/api/activity` | Activity logs |
| `/api/notifications` | Notification management |
| `/api/kindergartens` | Kindergarten data |

Frontend dev server proxies `/api/*` → `http://localhost:3001` (configured in `vite.config.ts`).

---

## TypeScript Conventions

- **Strict mode** is on in both client and server tsconfigs. Do not use `any` — use proper types or `unknown`.
- **Target**: ES2020 in both packages.
- **Server output**: CommonJS (`module: commonjs`) — use `require`/`module.exports` style is NOT needed since ts-node handles it, but be aware of this when debugging compiled output.
- **Client JSX**: `react-jsx` transform — no need to import React in every file.

---

## Hebrew / RTL Guidelines

- All user-facing strings should be in Hebrew.
- Error messages in `AppError` follow the pattern: Hebrew string for the user, English string for logs/developers.
- HTML `dir="rtl"` and `lang="he"` are set in `index.html` — do not remove.
- Tailwind classes: use `rtl:` variants when directional styling is needed.
- Font: Heebo (loaded from Google Fonts in `index.html`).

---

## Deployment

| Environment | Service | Config file |
|---|---|---|
| Frontend | Vercel | `vercel.json` |
| Backend | Railway | `railway.json` |
| Database | Railway (PostgreSQL 15) | Attached to backend service |

- Vercel serves the built `client/dist` as a static site and proxies `/api/*` to the Railway backend URL.
- Railway builds with NIXPACKS: `npm install && npm run build` then `npm run start --workspace=server`.
- Railway auto-restarts on failure (max 5 retries).
- **No GitHub Actions CI/CD** — deployments are triggered by pushes to the configured branch.

---

## Specialized Claude Agents

Ten agent profiles are pre-configured in `.claude/agents/`:

| Agent | When to use |
|---|---|
| `api-designer` | Designing new API endpoints |
| `backend-developer` | Server-side features, Express routes |
| `code-reviewer` | Code quality reviews |
| `debugger` | Diagnosing errors and stack traces |
| `deployment-engineer` | CI/CD and deploy config changes |
| `qa-expert` | Testing strategy |
| `react-specialist` | React performance, hooks, patterns |
| `security-engineer` | Security audits, auth, headers |
| `sql-pro` | Complex queries, schema changes |
| `typescript-pro` | Advanced TypeScript types |

---

## What Does Not Exist (yet)

- No test suite (no Jest, Vitest, or similar configured)
- No `.env.example` file
- No GitHub Actions CI/CD workflows
- No ESLint config file (relies on defaults / package.json config)
- No Prettier configuration

---

## Common Gotchas

1. **Port conflict**: Client runs on 3000, server on 3001. The Vite dev proxy handles `/api` forwarding — do not hardcode `localhost:3001` in frontend code.
2. **JWT_SECRET**: If not set, the server generates a random secret at startup. Restarting the server will invalidate all existing tokens in development.
3. **CORS in production**: Set `CLIENT_URL` env var to the Vercel deployment URL, or browser requests will be blocked.
4. **Database UUID**: All primary keys are UUIDs. Do not use integer IDs in new tables.
5. **Schema changes**: Update `server/src/db/schema.sql` AND write a migration — the schema file is the source of truth but `migrate.ts` handles actual DB changes.
6. **Build artifact**: `npm run build` in the server copies `schema.sql` to `dist/` — required for the production migration runner.
