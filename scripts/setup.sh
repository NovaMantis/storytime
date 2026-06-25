#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Storytime setup"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed. Install Node 20+ from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node 20+ is required (found $(node -v))"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — please add your Zoho IMAP and OpenAI credentials."
else
  echo ".env already exists"
fi

echo "==> Installing dependencies"
npm install

echo "==> Creating data directories"
mkdir -p data/projects data/logs

echo "==> Preparing Nuxt"
npm run postinstall

echo ""
echo "Setup complete."
echo "1. Edit .env with your Zoho IMAP credentials and OPENAI_API_KEY"
echo "2. Double-click 'Start Storytime.command' or run: bash scripts/start.sh"
