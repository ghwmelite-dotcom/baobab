# Baobab Worker

Cloudflare Worker backend for Baobab — The African AI Browser.

## Setup (first time)

1. `npm install` at repo root
2. `cd worker`
3. Provision Cloudflare resources (see `../docs/superpowers/plans/2026-05-02-baobab-worker-p0.md` Phase 2 for exact commands).
4. `npx wrangler d1 migrations apply baobab-db --local && npx wrangler d1 migrations apply baobab-db --remote`
5. Set required secrets — see `SECRETS.md`.

## Develop

```bash
npm run dev       # local Hono server via miniflare
npm test          # run vitest
npm run typecheck # tsc --noEmit
```

## Deploy

```bash
npm run deploy:staging  # to baobab-api-staging
npm run deploy          # to production
```

## Smoke

```bash
./scripts/smoke.sh https://api.baobab.africa
```

## License

AGPL-3.0
