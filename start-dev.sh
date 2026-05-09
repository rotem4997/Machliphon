#!/bin/bash
# One-command dev startup for Machliphon
set -e

echo "▶ Starting PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || true
until pg_isready -p 5432 -q; do sleep 1; done
echo "  ✅ PostgreSQL ready"

echo "▶ Starting Machliphon (client + server)..."
cd "$(dirname "$0")"
npm run dev
