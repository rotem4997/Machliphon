# 🔄 מחליפון — Machliphon

> ניהול חכם של מחליפות בגני ילדים ברמת הרשות המקומית

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + TypeScript  
- **Database**: PostgreSQL 15
- **State**: Zustand + React Query
- **Deploy**: Vercel (client) + Railway (server + DB)

## Quick Start

```bash
git clone https://github.com/rotem4997/machliphon.git
cd machliphon && npm install
cp server/.env.example server/.env  # Edit DATABASE_URL + JWT_SECRET
npm run db:migrate --workspace=server
npm run db:seed --workspace=server
npm run dev
```

Frontend: http://localhost:3000 | Backend: http://localhost:3001/health

## Demo Accounts (password: Demo1234!)
| Role | Email |
|------|-------|
| מנהל רשות | director@yokneam.muni.il |
| מדריכה | manager@yokneam.muni.il |
| מחליפה | miriam@example.com |

## Deploy
- **Railway** (backend): Connect GitHub repo, add PostgreSQL, set env vars
- **Vercel** (frontend): `cd client && vercel`

See full docs in each folder.
