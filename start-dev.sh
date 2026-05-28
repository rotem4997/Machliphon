#!/bin/bash
# Machliphon startup — starts PostgreSQL, builds the app, serves on http://localhost:3001
set -e
cd "$(dirname "$0")"

if ! command -v psql >/dev/null 2>&1; then
  echo "  ❌ psql not found — please install PostgreSQL before running this script."
  exit 1
fi

echo "▶ Starting PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || true
until pg_isready -p 5432 -q; do sleep 1; done
echo "  ✅ PostgreSQL ready"

echo "▶ Setting up database..."
sudo -u postgres psql -c "CREATE USER machliphon WITH PASSWORD 'machliphon123';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE machliphon OWNER machliphon;" 2>/dev/null || true
echo "  ✅ Database ready"

echo "▶ Building app..."
npm run build 2>&1 | grep -E "built|error|Error" || true
echo "  ✅ Build done"

echo "▶ Starting server..."
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

cd server
DATABASE_URL=postgresql://machliphon:machliphon123@localhost:5432/machliphon \
JWT_SECRET=machliphon-dev-secret-2026-change-in-production \
NODE_ENV=production \
PORT=3001 \
node dist/index.js &
SERVER_PID=$!
cd ..

sleep 4
if curl -s http://localhost:3001/health | grep -q "ok"; then
  echo ""
  echo "  ✅ Machliphon running at http://localhost:3001"
  echo "  Accounts: manager@yokneam.muni.il / director@yokneam.muni.il / miriam@example.com"
  echo "  Password: Demo1234!"
  echo ""
  wait $SERVER_PID
else
  echo "  ❌ Server failed to start. Check logs above."
  exit 1
fi
