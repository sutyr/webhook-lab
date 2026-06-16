// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

export function exportAsCurl(params: {
  targetUrl: string;
  payload: object;
  signatureHeader: string;
  requestId: string;
}): string {
  const body = JSON.stringify(params.payload, null, 2);
  const escapedBody = body.replace(/'/g, "'\\''");

  return [
    `curl -X POST '${params.targetUrl}'`,
    `  -H 'Content-Type: application/json'`,
    `  -H 'Stripe-Signature: ${params.signatureHeader}'`,
    `  -H 'User-Agent: WebhookLab/1.0'`,
    `  -H 'X-Webhook-Lab-Request-Id: ${params.requestId}'`,
    `  -d '${escapedBody}'`,
  ].join(' \\\n');
}

export function exportAsTypeScript(params: {
  targetUrl: string;
  payload: object;
}): string {
  const body = JSON.stringify(params.payload, null, 2);
  return `import crypto from 'node:crypto';

const payload = ${body};

const secret = 'whsec_your_secret_here'; // Replace with your signing secret
const timestamp = Math.floor(Date.now() / 1000);
const body = JSON.stringify(payload);
const signedPayload = \`\${timestamp}.\${body}\`;
// The secret is used verbatim — matching Stripe's official SDK, which does
// NOT strip the whsec_ prefix before HMAC-ing.
const signature = crypto
  .createHmac('sha256', secret)
  .update(signedPayload)
  .digest('hex');

const response = await fetch('${params.targetUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': \`t=\${timestamp},v1=\${signature}\`,
  },
  body, // sign and send the exact same bytes
});

console.log(response.status, await response.text());`;
}

export function exportAsPython(params: {
  targetUrl: string;
  payload: object;
}): string {
  const body = JSON.stringify(params.payload, null, 2);
  return `import hmac
import hashlib
import json
import time
import requests

payload = json.loads(r"""${body}""")

secret = 'whsec_your_secret_here'  # Replace with your signing secret
timestamp = int(time.time())
# Serialize once, then sign and send the exact same bytes. The separators
# match JavaScript's JSON.stringify (no spaces) so the signature is stable.
body = json.dumps(payload, separators=(',', ':'))
signed_payload = f"{timestamp}.{body}"
# The secret is used verbatim — matching Stripe's official SDK, which does
# NOT strip the whsec_ prefix before HMAC-ing.
signature = hmac.new(
    secret.encode(),
    signed_payload.encode(),
    hashlib.sha256
).hexdigest()

response = requests.post(
    '${params.targetUrl}',
    headers={
        'Content-Type': 'application/json',
        'Stripe-Signature': f't={timestamp},v1={signature}',
    },
    data=body,
)

print(response.status_code, response.text)`;
}
