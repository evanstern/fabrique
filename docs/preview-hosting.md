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
