# Baobab worker load test

[k6](https://k6.io/) load test for the Baobab Cloudflare Worker. Default run
models 100 concurrent users for 10 minutes against the deployed worker,
hitting the unauthed health endpoint.

## Install k6

- macOS: `brew install k6`
- Windows: `winget install k6 --source winget` or `choco install k6`
- Linux: see https://k6.io/docs/get-started/installation/

## Run

Against the deployed worker (default):

```
k6 run baobab-k6.js
```

Against a local dev worker:

```
BASE_URL=http://localhost:8787 k6 run baobab-k6.js
```

Exercise auth-protected endpoints (`/api/auth/me`, `/api/bookmarks`,
`/api/history`). This creates a throwaway signup account per VU iteration
(~6000 rows over the full 10-minute run) — only run against a dev/staging
DB you can wipe afterwards:

```
TEST_AUTH=1 k6 run baobab-k6.js
```

Smoke test (30s ramp to 10 VUs, then ramp down):

```
k6 run --stage 30s:10 --stage 30s:0 baobab-k6.js
```

## What it tests

| Endpoint               | Method | Authed | p95 budget |
| ---------------------- | ------ | ------ | ---------- |
| `/`                    | GET    | No     | 200ms      |
| `/api/auth/signup`     | POST   | No     | 1500ms (PBKDF2 is intentionally slow) |
| `/api/auth/me`         | GET    | Yes    | 400ms      |
| `/api/bookmarks`       | GET    | Yes    | 500ms      |
| `/api/history`         | GET    | Yes    | 500ms      |

Overall error budget: `http_req_failed` < 1%.

AI chat (`/api/ai/chat`) is intentionally **excluded** — each request burns
Workers AI credits, which is not appropriate for a budget-tier load test.

## Latest run

> Fill in after running. Aim for p95 < 200ms on `/`, < 500ms on
> `/api/bookmarks` and `/api/history`, and `http_req_failed` < 1%.
>
> The script has not yet been executed in CI; the local dev environment
> for this task did not have k6 on PATH. Run it manually against the
> deployed worker (https://baobab-api.ohcsghana-main.workers.dev) and
> paste the k6 summary below.

```
<paste `k6 run` summary here — http_req_duration percentiles, checks, vus_max, iterations>
```
