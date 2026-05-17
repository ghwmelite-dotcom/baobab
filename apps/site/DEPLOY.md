# Baobab landing — deploy runbook

The landing page is deployed to **Cloudflare Pages** on the **OHCS account**
(`f4f236a6cd8fbddf397c6e9de17d8113`), serving from `baobab.askozzy.work`.

These steps are **one-time manual setup**. After they're done, deploys
trigger automatically on push to `main`.

## Prerequisites

- Cloudflare dashboard access to the OHCS account
- `askozzy.work` zone is on this account (it already is — `osbrowser.askozzy.work` is a sibling)
- GitHub repo `ghwmelite-dotcom/baobab` is connectable to the account

## Step 1 — Create the Pages project

Cloudflare dashboard → **Pages** → **Create application** → **Connect to Git**:

| Field | Value |
| --- | --- |
| Repository | `ghwmelite-dotcom/baobab` |
| Production branch | `main` |
| Framework preset | `Astro` |
| Build command | `cd apps/site && npm ci && npm run build` |
| Build output directory | `apps/site/dist` |
| Project name | `baobab-site` |
| Environment variables | (none for v1) |

After first build succeeds (~2 min), Cloudflare assigns
a `baobab-site.pages.dev` preview URL. Verify it loads
the landing in a browser.

## Step 2 — Map the custom domain

Pages project → **Custom domains** → **Set up a custom domain**
→ enter `baobab.askozzy.work`.

Cloudflare auto-creates the CNAME record because the zone is on
the same account. SSL via Universal SSL is automatic; ready in
~1–5 min.

## Step 3 — Issue the Web Analytics token

Pages project → **Settings** → **Analytics** → **Enable Web Analytics**.
Copy the issued JWT-style token (looks like `abc123def456…`).

## Step 4 — Replace the Cloudflare Analytics token in `Base.astro`

Edit `apps/site/src/layouts/Base.astro`. Find:

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD"}'></script>
```

Replace `REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD` with the actual token. Commit + push.

The next build picks it up; analytics start reporting in the
Cloudflare dashboard within ~24 h.

## Step 5 — Confirm the Lighthouse CI workflow

`.github/workflows/site-deploy.yml` is committed. It runs on every PR
touching `apps/site/**`. Requires `CLOUDFLARE_API_TOKEN` secret already
present in the repo (other workflows use it; verify with `gh secret list`).

## Verifying the live site

After Steps 1–4:

```bash
curl -I https://baobab.askozzy.work/
# Expect: HTTP/2 200, cf-ray header, valid SSL
```

Look for the analytics beacon firing in the Cloudflare dashboard
(Pages → baobab-site → Analytics) within 24 h.

## Troubleshooting

- **Build fails on Cloudflare:** match local `cd apps/site && npm ci && npm run build`. Node 20.x; `@astrojs/cloudflare` requires it.
- **Custom domain stuck on "Verifying":** CNAME record sometimes takes 5 min to propagate. If still stuck after 15 min, recreate it manually in the DNS panel.
- **Analytics not appearing:** confirm the token in Base.astro matches the dashboard exactly (whitespace counts).
