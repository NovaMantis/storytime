#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env file found. Run scripts/setup.sh first."
  exit 1
fi

PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || echo 3200)
PORT=${PORT:-3200}
export PORT

echo "==> Starting Storytime on http://localhost:${PORT}"
npm run dev -- --open
