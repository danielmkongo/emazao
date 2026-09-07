#!/usr/bin/env bash
# eMazao server deploy. Run from the repo root on the server:  ./scripts/deploy.sh
#
# Rebuilds both bundles and restarts the API. It never writes .env — that file is
# gitignored and holds the live domain, Atlas password and NIDA key, so it is the
# operator's to manage. The guard below exists because `git pull` DELETES it on a
# clone that still tracked it, which silently drops the app onto default config.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
APP_NAME="${APP_NAME:-emazao}"

if [[ ! -f backend/.env ]]; then
  echo "FATAL: backend/.env is missing."
  echo "Without it the API binds the default port and points at a local Mongo"
  echo "that isn't there, so the old process keeps serving the old UI."
  echo "Recover the last committed copy with:"
  echo "  git show e9fc8d7^:backend/.env > backend/.env"
  echo "then re-check CLIENT_URL (your domain) and NODE_ENV=production."
  exit 1
fi

echo "==> Pulling"
git pull --ff-only

echo "==> Building frontend"
cd "$ROOT/frontend"
npm ci
npm run build

echo "==> Building backend"
cd "$ROOT/backend"
npm ci
npm run build

# A stale process holding the port is the usual reason a rebuild appears to do
# nothing: express.static captured the old dist path at boot. Replace it rather
# than reload it.
echo "==> Restarting $APP_NAME"
cd "$ROOT"
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Serving on port $(grep -E '^PORT=' backend/.env | cut -d= -f2)"
pm2 logs "$APP_NAME" --lines 20 --nostream
