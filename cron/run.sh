#!/bin/sh

if [ -z "$APP_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "ERROR: APP_URL and CRON_SECRET must be set"
  echo "APP_URL=$APP_URL"
  echo "CRON_SECRET is $([ -n "$CRON_SECRET" ] && echo 'set' || echo 'NOT SET')"
  exit 1
fi

echo "Triggering daily sync at $APP_URL/api/cron"
echo "Waiting 5s for network..."
sleep 5

HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" \
  -X POST "$APP_URL/api/cron" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 1800 \
  --connect-timeout 10 \
  2>&1) || true

echo "HTTP Status: $HTTP_CODE"
cat /tmp/response.txt 2>/dev/null
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "Sync completed successfully."
else
  echo "Sync failed with status $HTTP_CODE"
  exit 1
fi
