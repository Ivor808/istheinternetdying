#!/bin/sh

echo "=== Cron job starting ==="
echo "APP_URL: $APP_URL"
echo "CRON_SECRET: $([ -n "$CRON_SECRET" ] && echo 'set' || echo 'NOT SET')"
echo "Date: $(date -u)"

if [ -z "$APP_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "ERROR: APP_URL and CRON_SECRET must be set"
  exit 1
fi

URL="$APP_URL/api/cron"
echo "Calling: $URL"

HTTP_CODE=$(curl -v -o /tmp/response.txt -w "%{http_code}" \
  -X POST "$URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 1800 \
  --connect-timeout 30 \
  2>/tmp/curl_debug.txt) || true

echo "=== Curl debug ==="
cat /tmp/curl_debug.txt
echo ""
echo "=== Response (HTTP $HTTP_CODE) ==="
cat /tmp/response.txt 2>/dev/null
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "=== Sync completed successfully ==="
else
  echo "=== Sync failed with HTTP $HTTP_CODE ==="
fi

echo "=== Cron job finished ==="
exit 0
