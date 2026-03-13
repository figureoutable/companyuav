#!/usr/bin/env bash
# Install cron: every day at 1:00 AM local time → run-daily-fetch.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/scripts/run-daily-fetch.sh"
chmod +x "$RUNNER"
mkdir -p "$ROOT/logs"

CRON_LINE="0 1 * * * /bin/bash $RUNNER"

if crontab -l 2>/dev/null | grep -qF "$RUNNER"; then
  echo "Cron already has this job:"
  crontab -l | grep -F "$RUNNER" || true
  exit 0
fi

(crontab -l 2>/dev/null | grep -vF "$RUNNER" || true; echo "$CRON_LINE") | crontab -
echo "Installed daily 1am cron:"
echo "  $CRON_LINE"
echo ""
echo "Logs: $ROOT/logs/daily-fetch.log"
echo "List crontab: crontab -l"
echo "Remove: crontab -e  (delete that line)"
