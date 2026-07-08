#!/bin/bash
set -e
cd "$(dirname "$0")"

git pull origin master

# Reproducible install from package-lock.json (never mutates the lockfile)
npm ci

# Idempotent hand-written migration (roles/slugs/safety tables) — safe on
# every deploy. For OTHER schema changes run `npm run db:push` MANUALLY and
# review its plan; drizzle-kit can propose destructive statements.
# npm run db:migrate
# One-off after the 2026-07 uploads-layout split (idempotent; run once on
# every machine that has an uploads/ dir — moves files into uploads/users/
# and uploads/receipts/ and rewrites their URLs in the DB):
# npm run db:migrate-uploads
# Catalog/admin seed is idempotent, safe on every deploy:
# npm run db:seed

# Build while the old server keeps serving from .next; brief blip on restart.
npm run build

pm2 startOrRestart ecosystem.config.js

echo "Deployment complete."
