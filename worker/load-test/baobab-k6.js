// k6 load test for the Baobab Cloudflare Worker.
//
// Default run: 100 concurrent VUs for 10 minutes hitting the unauthed health
// endpoint. The health endpoint is the cheapest probe — it exercises the full
// middleware chain (requestId, cors, secureHeaders, residency) without
// touching D1 or KV, so it's a pure "can the worker absorb concurrent fetch
// events?" signal.
//
// With TEST_AUTH=1 the script ALSO signs up a throwaway account per VU
// iteration and hits /api/auth/me, /api/bookmarks, /api/history with the
// resulting access token. AI chat is intentionally excluded — too expensive
// for a budget-tier load test.
//
// Usage:
//   k6 run baobab-k6.js
//   BASE_URL=http://localhost:8787 k6 run baobab-k6.js
//   TEST_AUTH=1 k6 run baobab-k6.js
//
// Override stages for a smoke run:
//   k6 run --stage 30s:10 --stage 30s:0 baobab-k6.js

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'https://baobab-api.ohcsghana-main.workers.dev'
const TEST_AUTH = __ENV.TEST_AUTH === '1'

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // ramp up
    { duration: '8m', target: 100 }, // sustain
    { duration: '1m', target: 0 },   // ramp down
  ],
  thresholds: {
    // p95 latency budgets per endpoint class.
    'http_req_duration{type:health}':    ['p(95)<200'],
    'http_req_duration{type:signup}':    ['p(95)<1500'], // PBKDF2 is expensive
    'http_req_duration{type:me}':        ['p(95)<400'],
    'http_req_duration{type:bookmarks}': ['p(95)<500'],
    'http_req_duration{type:history}':   ['p(95)<500'],
    // Overall error budget across ALL requests.
    'http_req_failed': ['rate<0.01'],
    // Custom check failure rate.
    'errors': ['rate<0.01'],
  },
  // Disable HTTP/2 connection reuse skew metrics to keep summary clean.
  noConnectionReuse: false,
}

const errors = new Rate('errors')

// Signup returns { access, refresh, accessJti, refreshJti, user } — see
// worker/src/lib/jwt.ts (IssuedTokens) and routes/auth.ts (signup handler).
// We use `access` as the bearer token for subsequent requests.
function signup() {
  const email = `loadtest-${__VU}-${__ITER}-${Date.now()}@baobab.test`
  const password = 'LoadTest123!'
  const res = http.post(
    `${BASE}/api/auth/signup`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'signup' },
    },
  )
  const ok = check(res, { 'signup 200': (r) => r.status === 200 })
  if (!ok) {
    errors.add(1)
    return null
  }
  try {
    return res.json('access')
  } catch {
    errors.add(1)
    return null
  }
}

export default function () {
  group('health', () => {
    const res = http.get(`${BASE}/`, { tags: { type: 'health' } })
    const ok = check(res, {
      'health 200': (r) => r.status === 200,
      'health has version': (r) => {
        try { return !!r.json('version') } catch { return false }
      },
    })
    if (!ok) errors.add(1)
  })

  if (TEST_AUTH) {
    const token = signup()
    if (!token) {
      sleep(1)
      return
    }

    const authedHeaders = {
      headers: { Authorization: `Bearer ${token}` },
    }

    group('me', () => {
      const res = http.get(`${BASE}/api/auth/me`, {
        ...authedHeaders,
        tags: { type: 'me' },
      })
      const ok = check(res, { 'me 200': (r) => r.status === 200 })
      if (!ok) errors.add(1)
    })

    group('bookmarks', () => {
      const res = http.get(`${BASE}/api/bookmarks`, {
        ...authedHeaders,
        tags: { type: 'bookmarks' },
      })
      const ok = check(res, { 'bookmarks 200': (r) => r.status === 200 })
      if (!ok) errors.add(1)
    })

    group('history', () => {
      const res = http.get(`${BASE}/api/history`, {
        ...authedHeaders,
        tags: { type: 'history' },
      })
      const ok = check(res, { 'history 200': (r) => r.status === 200 })
      if (!ok) errors.add(1)
    })
  }

  // Pace each VU at ~1 req/s so 100 VUs ~ 100 rps steady-state. Worker
  // free-tier limit is 100k req/day; 10 min at 100rps = 60k requests, fits.
  sleep(1)
}
