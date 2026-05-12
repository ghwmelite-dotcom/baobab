# Baobab

The African AI Browser. See `docs/` for architecture and build instructions.

License: AGPL-3.0

## Observability — Sentry crash reporting

Sentry is wired into the desktop frontend and the Cloudflare worker but is
fully optional. When the DSN is unset, init is a no-op so developers without
a Sentry account can build and run cleanly.

### Desktop (frontend)

Set `VITE_SENTRY_DSN` at build/dev time. Either export it in your shell, or
put it in `apps/desktop/.env.local`:

```
VITE_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

When set, `Sentry.init` runs in `apps/desktop/src/main.tsx` and the
`ErrorBoundary` (`apps/desktop/src/error/ErrorBoundary.tsx`) reports caught
React errors via `Sentry.captureException`.

### Worker (backend)

Set `SENTRY_DSN` as a secret (never commit the real DSN to `wrangler.toml`):

```
cd worker
wrangler secret put SENTRY_DSN
```

When set, the Hono handler in `worker/src/index.ts` is wrapped with
`@sentry/cloudflare`'s `withSentry`. Both surfaces use
`tracesSampleRate: 0` — error capture only, no performance tracing.
