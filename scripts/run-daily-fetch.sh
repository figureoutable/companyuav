#!/usr/bin/env bash
# Run from cron at 1am: fetch previous day (~2000 companies), save CSV, email via Resend.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
mkdir -p "$ROOT/logs"
exec >> "$ROOT/logs/daily-fetch.log" 2>&1
echo "===== $(date -u +"%Y-%m-%dT%H:%M:%SZ") daily-fetch start ====="
npm run daily-fetch
echo "===== $(date -u +"%Y-%m-%dT%H:%M:%SZ") daily-fetch end ====="
