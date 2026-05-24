# Preview hosting

Fabrique is reachable publicly at **https://fabrique.infinitynode.ai**
during development so it can be shared without tailnet access.

This is the v1 dev/preview stack: app + Mongo + artifacts volume,
per [[v1-storage-and-deployment]].

## Public-routing stack

```
Cloudflare DNS (fabrique.infinitynode.ai)
        ↓
Cloudflare Tunnel (cloudflared on this host)
        ↓ http://localhost:80
traefik (docker container on :80)
        ↓ http://host.docker.internal:8422
fabrique container (RR7 production build, port 3000 → host 8422)
```

## Containers in this repo

- `app` — the RR7 app, built via `Dockerfile`. Bind-mounts
  `./artifacts` to `/app/artifacts` for generated preview files.
  Host port `${APP_HOST_PORT:-8422}` → container `3000`. Connects
  to MongoDB Atlas via `MONGO_URL` (set in `.env`).

Mongo is **hosted on Atlas**, not run locally. The dev VM lacks
AVX support, so MongoDB 5+ won't run in a container here. Atlas
free tier handles dev and is production-realistic. See
[[v1-storage-and-deployment]] for the rationale.

## Environment

See `.env.example` at repo root.

- `MONGO_URL` — **required**, Atlas connection string
  (`mongodb+srv://...`)
- `APP_HOST_PORT` — optional, host port (default `8422`)
- `PUBLIC_URL` — optional, base URL used to generate artifact links
  (default `http://localhost:8422`; in production this is the
  public domain)

Copy `.env.example` to `.env` and fill in `MONGO_URL`. `.env` is
gitignored — never commit it.

## Dev loop

```bash
# from a worktree at repo root
cp .env.example .env  # first time only; fill in MONGO_URL

docker compose build
docker compose up -d
docker compose logs -f app
docker compose down
```

Mongo data lives in Atlas; there's nothing volume-bound to wipe
locally.

## Branch preview loop

Feature worktrees can be exposed as hot-reload previews without merging
to `dev`. A preview URL has this shape:

```txt
https://<slug>-fabrique.infinitynode.ai
```

The repo-owned operator commands are:

```bash
scripts/preview-start <slug> <worktree>
scripts/preview-stop <slug>
scripts/preview-list
scripts/preview-clean [--older-than-days N]
```

`package.json` also exposes the same commands as `pnpm preview:start`,
`pnpm preview:stop`, `pnpm preview:list`, and `pnpm preview:clean`.

`preview-start` validates that `<slug>` is DNS-label-safe, including a
54-character maximum so `<slug>-fabrique` remains one valid DNS label,
allocates a stable port from `5300-5399`, writes a systemd user service named
`fabrique-preview-<slug>`, and runs this command from the feature
worktree:

```bash
pnpm exec react-router dev --host 0.0.0.0 --port <port>
```

The service loads `<worktree>/.env` when present and sets these preview
defaults explicitly:

- `NODE_ENV=development`
- `PUBLIC_URL=https://<slug>-fabrique.infinitynode.ai`
- `ARTIFACTS_DIR=<worktree>/artifacts`
- `FABRIQUE_ALLOWED_HOSTS=<slug>-fabrique.infinitynode.ai,dev-fabrique.infinitynode.ai,localhost`

The preview uses the same auth/environment expectations as the normal
dev and production stacks: `MONGO_URL`, `ANTHROPIC_API_KEY`,
`FABRIQUE_PASSWORD`, and `FABRIQUE_AUTH_SECRET` come from `.env`. The
shared password gate remains the preview auth boundary.

### Preview registry

Preview metadata is stored outside tracked source by default:

```txt
${FABRIQUE_PREVIEW_REGISTRY:-$HOME/.local/state/fabrique/previews.json}
```

The registry maps each slug to its branch, worktree, assigned port,
hostname, systemd service name, and timestamps. Existing slugs reuse
their registered port. `preview-stop` is idempotent: it tolerates a
missing registry entry, missing unit file, or already-stopped service.
`preview-clean` removes stale entries when the registered worktree no
longer exists, the systemd unit no longer exists, or an optional age
threshold is exceeded.

### Host routing

The scripts do not edit `/home/openclaw/.config/traefik/dynamic.yml` or
`/etc/cloudflared/config.yml` directly. Those files are host-local and
may require sudo/restart behavior outside a feature PR. Instead,
`preview-start` prints exact snippets for the operator to add, and
`preview-stop` prints the matching route names to remove.

For a preview slug `0024-hot-reload-branch-previews` on port `5300`, the
host-local routing shape is:

```yaml
# /home/openclaw/.config/traefik/dynamic.yml
http:
  routers:
    fabrique-preview-0024-hot-reload-branch-previews:
      rule: Host(`0024-hot-reload-branch-previews-fabrique.infinitynode.ai`)
      service: fabrique-preview-0024-hot-reload-branch-previews
  services:
    fabrique-preview-0024-hot-reload-branch-previews:
      loadBalancer:
        servers:
          - url: http://host.docker.internal:5300
```

```yaml
# /etc/cloudflared/config.yml, before the 404 catch-all
- hostname: 0024-hot-reload-branch-previews-fabrique.infinitynode.ai
  service: http://localhost:80
```

Create DNS when needed with:

```bash
cloudflared tunnel route dns <tunnel-id> 0024-hot-reload-branch-previews-fabrique.infinitynode.ai
```

### Vite host policy

Vite is configured with explicit allowed hosts plus the controlled
project-owned suffix `.fabrique.infinitynode.ai`. That suffix allows
`dev-fabrique.infinitynode.ai` and feature preview hostnames while
avoiding `allowedHosts: true`, which Vite documents as unsafe because it
can expose the dev server to DNS rebinding.

### Coda feature lifecycle

coda-lite feature cleanup does not currently provide a built-in hook for
repo-specific resource teardown. This PR provides the idempotent callable
seam for that future integration:

```bash
scripts/preview-stop <slug>
```

Until coda-lite grows a cleanup hook, call `preview-stop` before or
during feature finish for any preview that was started from a feature
worktree. Normal cleanup should not leave zombie Fabrique preview
servers when that command is called.

## Host-side wiring (already in place; documented here for completeness)

These config files live outside the repo and don't ship with PRs.
They route public traffic to the app container:

1. **traefik** — `/home/openclaw/.config/traefik/dynamic.yml` has
   a `fabrique` router + service pointing at
   `http://host.docker.internal:8422`.

2. **cloudflared** — `/etc/cloudflared/config.yml` has an ingress
   entry for `fabrique.infinitynode.ai` → `http://localhost:80`
   (before the 404 catch-all). Restart with
   `sudo systemctl restart cloudflared` after edits.

3. **DNS** — the Cloudflare CNAME was created via
   `cloudflared tunnel route dns <tunnel-id> fabrique.infinitynode.ai`.
