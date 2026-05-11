#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:8787}"
echo "Smoking $BASE"

echo "1. Health"
curl -fsS "$BASE/" | jq

echo "2. Residency headers"
curl -sI "$BASE/" | grep -i 'X-Baobab-'

echo "3. Auth required on protected route"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/history")
[ "$code" = "401" ] || { echo "Expected 401, got $code"; exit 1; }
echo "  401 OK"

echo "4. Signup"
RESP=$(curl -fsS -X POST "$BASE/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke-$RANDOM@x.com\",\"password\":\"long-password-123\"}")
ACCESS=$(echo "$RESP" | jq -r .access)
echo "  Got access token (len ${#ACCESS})"

echo "5. Authed /me"
curl -fsS "$BASE/api/auth/me" -H "Authorization: Bearer $ACCESS" | jq .email

echo "All smoke checks passed."
