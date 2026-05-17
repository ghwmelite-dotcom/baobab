# Required Secrets

Set via `npx wrangler secret put <NAME>` (production environment).

| Secret | Required | Used by |
|---|---|---|
| AUTH_SECRET | Yes | JWT signing (32+ char random string) |
| ENCRYPTION_KEY | Yes | At-rest encryption of sensitive fields |
| ADMIN_API_KEY | Yes | Admin/migration endpoints |
| OTP_AFRICASTALKING_USERNAME | Recommended | Africa's Talking SMS provider |
| OTP_AFRICASTALKING_KEY | Recommended | Africa's Talking SMS provider |
| OTP_TWILIO_SID | Optional | Twilio fallback |
| OTP_TWILIO_TOKEN | Optional | Twilio fallback |
| OTP_TWILIO_FROM | Optional | Twilio sender number |
| OTP_TERMII_KEY | Optional | Termii (Nigeria fallback) |
| OTP_TERMII_FROM | Optional | Termii sender ID |

## Generating AUTH_SECRET

```bash
openssl rand -base64 48 | npx wrangler secret put AUTH_SECRET --env production
```

## Google Programmable Search Engine (PSE)

The `/api/search` route requires two additional secrets:

| Secret | Required | Used by |
|---|---|---|
| GOOGLE_PSE_API_KEY | Yes | Google Custom Search JSON API key |
| GOOGLE_PSE_CX | Yes | Programmable Search Engine ID (cx) |

### `GOOGLE_PSE_API_KEY`

1. Go to https://console.cloud.google.com/apis/credentials
2. Click "Create credentials → API key"
3. Restrict the key:
   - API restrictions → "Custom Search JSON API" only
   - Application restrictions → "None" for now (HTTP referrer doesn't work for workers)
4. Set in worker:
   ```bash
   wrangler secret put GOOGLE_PSE_API_KEY
   ```

### `GOOGLE_PSE_CX`

1. Go to https://programmablesearchengine.google.com/controlpanel/create
2. Name: "Baobab Search"
3. Sites to search: "Search the entire web" (toggle on)
4. Create. Copy the "Search engine ID" (the `cx` value).
5. Set in worker:
   ```bash
   wrangler secret put GOOGLE_PSE_CX
   ```

### Daily budget

Set a billing alert in Google Cloud Console at $40/day. PSE pricing: 100 queries/day free, then $5/1000 (capped at $50/day = 10K queries).
