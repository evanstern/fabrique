# Preview hosting

Fabrique is reachable publicly at **https://fabrique.infinitynode.ai**
during development so it can be shared without tailnet access.

This is **preview hosting only** — not the v1 production deployment
shape. Card #3 (the locked v1 deployment) will add Mongo and the
artifacts volume; this file documents only what's running now.

## Stack

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

- `app` — the RR7 app, built via `Dockerfile`, exposed on host port
  `8422`.

That's the whole `docker-compose.yml` for now. No Mongo, no volumes
yet — those land with card #3.

## Dev loop

```bash
# from this worktree
docker compose build
docker compose up -d
docker compose logs -f app
docker compose down
```

## Host-side wiring (already in place; documented here for completeness)

These config files live outside the repo and don't ship with PRs.
They were set up to route public traffic to this container:

1. **traefik** — added a `fabrique` router + service in
   `/home/openclaw/.config/traefik/dynamic.yml` pointing at
   `http://host.docker.internal:8422`.

2. **cloudflared** — added a `fabrique.infinitynode.ai` ingress
   entry in `/etc/cloudflared/config.yml` (before the 404
   catch-all) pointing at `http://localhost:80`.
   `sudo systemctl restart cloudflared` to apply.

3. **DNS** — created via
   `cloudflared tunnel route dns <tunnel-id> fabrique.infinitynode.ai`,
   which set up the Cloudflare CNAME.

## Production note

When card #3 lands, this `docker-compose.yml` becomes the real v1
dev/preview stack (app + Mongo + artifacts volume). The hosting
plumbing above does not need to change.
