#!/usr/bin/env bash
# Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
#
# Real-Stripe parity test — proves a single handler accepts BOTH:
#   1. Events fired from Webhook Lab (synthetic, custom decline codes)
#   2. Events fired from `stripe trigger` (real Stripe API)
#
# Both must verify using the same `whsec_...` secret.
#
# Prerequisites:
#   - `stripe` CLI installed and authenticated (`stripe login`)
#   - Webhook Lab running locally (default: http://localhost:3010, prod build)
#   - This script will start the receiver and stripe listen automatically.
#
# Usage:
#   chmod +x scripts/stripe-parity-test.sh
#   ./scripts/stripe-parity-test.sh

set -euo pipefail

WEBHOOK_LAB_URL="${WEBHOOK_LAB_URL:-http://localhost:3010}"
RECEIVER_PORT="${RECEIVER_PORT:-5050}"
RECEIVER_LOG="/tmp/parity-receiver.log"
STRIPE_LISTEN_LOG="/tmp/parity-stripe-listen.log"

# Sanity: Stripe CLI
if ! command -v stripe >/dev/null 2>&1; then
  echo "ERROR: stripe CLI not found. Install with: brew install stripe/stripe-cli/stripe"
  exit 1
fi

# Sanity: Webhook Lab is up
if ! curl -sf "$WEBHOOK_LAB_URL/api/health" > /dev/null; then
  echo "ERROR: Webhook Lab not reachable at $WEBHOOK_LAB_URL"
  echo "Start it with: WEBHOOK_LAB_ALLOW_PRIVATE=true PORT=3010 pnpm --filter web start"
  exit 1
fi

cleanup() {
  echo
  echo "Cleaning up..."
  [[ -n "${RECEIVER_PID:-}" ]] && kill "$RECEIVER_PID" 2>/dev/null || true
  [[ -n "${STRIPE_PID:-}" ]] && kill "$STRIPE_PID" 2>/dev/null || true
}
trap cleanup EXIT

# 1. Start the Stripe SDK verifier
echo "==> Starting Stripe SDK verifier on :$RECEIVER_PORT"
cat > /tmp/parity-receiver.mjs <<'EOF'
import { createServer } from 'http';
import Stripe from 'stripe';
const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-10-29.clover' });
const SECRET = process.env.SECRET;
if (!SECRET) { console.error('SECRET env var required'); process.exit(1); }
createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const sig = req.headers['stripe-signature'] || '';
    const source = req.headers['x-webhook-lab-request-id'] ? 'webhook-lab' : 'stripe-cli';
    try {
      const event = stripe.webhooks.constructEvent(body, sig, SECRET);
      console.log(JSON.stringify({ source, verified: true, type: event.type, id: event.id }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (err) {
      console.log(JSON.stringify({ source, verified: false, error: err.message.split('\n')[0] }));
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"ok":false}');
    }
  });
}).listen(Number(process.env.PORT), () => console.log('receiver up on :' + process.env.PORT));
EOF

# Use webhook-lab's stripe dep
cd "$(dirname "$0")/.."
PORT=$RECEIVER_PORT SECRET=__PLACEHOLDER__ node /tmp/parity-receiver.mjs > "$RECEIVER_LOG" 2>&1 &
RECEIVER_PID=$!
sleep 1

# 2. Start stripe listen and capture the signing secret
echo "==> Starting stripe listen --forward-to http://localhost:$RECEIVER_PORT"
stripe listen --forward-to "http://localhost:$RECEIVER_PORT" --print-secret > /tmp/parity-secret 2>/dev/null &
SECRET_PID=$!
sleep 3
WEBHOOK_SECRET=$(cat /tmp/parity-secret | grep -oE 'whsec_[a-zA-Z0-9_]+' | head -1)
kill $SECRET_PID 2>/dev/null || true

if [[ -z "$WEBHOOK_SECRET" ]]; then
  echo "ERROR: Failed to get webhook secret from stripe CLI"
  exit 1
fi
echo "    Secret: ${WEBHOOK_SECRET:0:15}..."

# Restart receiver with the real secret
kill $RECEIVER_PID 2>/dev/null || true
sleep 1
PORT=$RECEIVER_PORT SECRET=$WEBHOOK_SECRET node /tmp/parity-receiver.mjs > "$RECEIVER_LOG" 2>&1 &
RECEIVER_PID=$!
sleep 1

# Start the real stripe listen forwarder
stripe listen --forward-to "http://localhost:$RECEIVER_PORT" --skip-verify > "$STRIPE_LISTEN_LOG" 2>&1 &
STRIPE_PID=$!
sleep 3

# 3. Fire from Webhook Lab
echo
echo "==> Firing payment_intent.succeeded from Webhook Lab → receiver"
WL_RESP=$(curl -s -X POST "$WEBHOOK_LAB_URL/api/fire" \
  -H 'Content-Type: application/json' \
  -d "{\"eventType\":\"payment_intent.succeeded\",\"targetUrl\":\"http://localhost:$RECEIVER_PORT\",\"signingSecret\":\"$WEBHOOK_SECRET\"}")
WL_STATUS=$(echo "$WL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['statusCode'])")
echo "    Receiver returned: $WL_STATUS"

# 4. Trigger from real Stripe
echo
echo "==> Triggering payment_intent.succeeded from real Stripe CLI"
stripe trigger payment_intent.succeeded > /dev/null 2>&1 &
sleep 5

# 5. Verify both verified successfully
echo
echo "==> Receiver log:"
grep -E '"verified"' "$RECEIVER_LOG" | head -10

echo
echo "==> Summary:"
WL_OK=$(grep -c '"source":"webhook-lab","verified":true' "$RECEIVER_LOG" || true)
SC_OK=$(grep -c '"source":"stripe-cli","verified":true' "$RECEIVER_LOG" || true)
WL_BAD=$(grep -c '"source":"webhook-lab","verified":false' "$RECEIVER_LOG" || true)
SC_BAD=$(grep -c '"source":"stripe-cli","verified":false' "$RECEIVER_LOG" || true)
echo "    Webhook Lab events verified: $WL_OK (failed: $WL_BAD)"
echo "    Stripe CLI events verified:  $SC_OK (failed: $SC_BAD)"
if [[ "$WL_OK" -gt 0 && "$SC_OK" -gt 0 && "$WL_BAD" -eq 0 && "$SC_BAD" -eq 0 ]]; then
  echo
  echo "    ✅ PARITY CONFIRMED — handler accepts both sources with one secret."
  exit 0
else
  echo
  echo "    ❌ Parity failed. Inspect $RECEIVER_LOG"
  exit 1
fi
