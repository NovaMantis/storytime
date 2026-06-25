#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env file found. Run scripts/setup.sh first."
  exit 1
fi

echo "==> Building Storytime"
npm run build

PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || echo 3000)
PORT=${PORT:-3000}

echo "==> Starting Storytime on http://localhost:${PORT}"
open "http://localhost:${PORT}" 2>/dev/null || true
npm start
