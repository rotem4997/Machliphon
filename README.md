# 🔄 מחליפון — Machliphon

> ניהול חכם של מחליפות בגני ילדים ברמת הרשות המקומית

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15
- **State**: Zustand + React Query
- **ML**: Pure TypeScript logistic regression (no external runtime)
- **Deploy**: Vercel (client) + Render (server + DB)

## Quick Start

```bash
git clone https://github.com/rotem4997/machliphon.git
cd machliphon && npm install

# Create server/.env with:
#   DATABASE_URL=<postgres connection string>
#   JWT_SECRET=<random secret>

npm run db:migrate --workspace=server
npm run db:seed-full --workspace=server
npm run dev
```

Frontend: http://localhost:3000 | Backend: http://localhost:3001/health

## Demo Accounts (password: `Demo1234!`)

| Role | Email |
|------|-------|
| מנהל רשות (authority_admin) | director@yokneam.muni.il |
| מדריכה (manager) | manager@yokneam.muni.il |
| מחליפה (substitute) | miriam@example.com |

## Deploy

- **Render** (backend): Connect GitHub repo, add PostgreSQL 15, set `DATABASE_URL` + `JWT_SECRET` + `CLIENT_URL`
- **Vercel** (frontend): connect repo — `vercel.json` handles build and API proxy to Render automatically

See `CLAUDE.md` for full architecture and development notes.
