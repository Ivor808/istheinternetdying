#!/bin/sh
set -e

if [ -z "$APP_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "ERROR: APP_URL and CRON_SECRET must be set"
  exit 1
fi

echo "Triggering daily sync at $APP_URL/api/cron"
curl -sf -X POST "$APP_URL/api/cron" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
echo ""
echo "Done."
exit 0
