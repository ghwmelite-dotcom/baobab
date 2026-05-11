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
