#!/usr/bin/env bash
set -euo pipefail

# Smoke test para validação local do webhook + inspeção do DB.
#
# Requer:
# - WHATSAPP_WEBHOOK_VERIFY_TOKEN (para o GET verify)
# - ADMIN_SEED_TOKEN (para o GET /api/admin/inspect)
#
# Opcional:
# - BASE_URL (default: http://localhost:3000)

BASE_URL="${BASE_URL:-http://localhost:3000}"

if [[ -z "${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}" ]]; then
  echo "Missing env WHATSAPP_WEBHOOK_VERIFY_TOKEN" >&2
  exit 1
fi

if [[ -z "${ADMIN_SEED_TOKEN:-}" ]]; then
  echo "Missing env ADMIN_SEED_TOKEN" >&2
  exit 1
fi

echo "==> 1/2 GET verify (sanity check)"
VERIFY_URL="${BASE_URL}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${WHATSAPP_WEBHOOK_VERIFY_TOKEN}&hub.challenge=123"
VERIFY_RESP="$(curl -sS -w "\n%{http_code}" "$VERIFY_URL")"
VERIFY_BODY="$(echo "$VERIFY_RESP" | head -n 1)"
VERIFY_CODE="$(echo "$VERIFY_RESP" | tail -n 1)"

echo "HTTP $VERIFY_CODE"
echo "Body: $VERIFY_BODY"
if [[ "$VERIFY_CODE" != "200" ]]; then
  echo "Verify failed. Check WHATSAPP_WEBHOOK_VERIFY_TOKEN and server logs." >&2
  exit 1
fi

echo
echo "==> 2/2 Inspect DB (last 20)"
INSPECT_URL="${BASE_URL}/api/admin/inspect?limit=20"
INSPECT_RESP="$(curl -sS -w "\n%{http_code}" "$INSPECT_URL" -H "x-admin-seed-token: ${ADMIN_SEED_TOKEN}")"
INSPECT_BODY="$(echo "$INSPECT_RESP" | head -n 1)"
INSPECT_CODE="$(echo "$INSPECT_RESP" | tail -n 1)"

echo "HTTP $INSPECT_CODE"
if [[ -n "$INSPECT_BODY" ]]; then
  echo "$INSPECT_BODY" | cat
else
  echo "(empty body)"
fi

if [[ "$INSPECT_CODE" != "200" ]]; then
  echo "Inspect failed. Common causes:" >&2
  echo "- Server env ADMIN_SEED_TOKEN not set (401)" >&2
  echo "- DATABASE_URL/Prisma not set or DB down (500)" >&2
  echo "- Route not found (404)" >&2
  exit 1
fi

echo
echo "OK"


