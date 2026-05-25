# Deployment And Preview Hosting

Fabrique is packaged as a React Router production server with external MongoDB and filesystem-backed HTML artifacts. The deployment model is deliberately simple: one app container, one mounted artifacts directory, MongoDB Atlas, and optional host-local routing for public domains and branch previews.

## Production Container

`Dockerfile` builds in four stages:

1. `base`: Node 20 Alpine with Corepack and pnpm.
2. `deps`: installs all dependencies with the frozen lockfile.
3. `build`: copies source and runs `pnpm build`.
4. `runtime`: installs production dependencies, copies `build/`, exposes port `3000`, and runs `pnpm start`.

`docker-compose.yml` runs that image as the `fabrique` container, maps `${APP_HOST_PORT:-8422}:3000`, and mounts `./artifacts:/app/artifacts`.

Required compose environment:

- `MONGO_URL`
- `ANTHROPIC_API_KEY`
- `FABRIQUE_PASSWORD`
- `FABRIQUE_AUTH_SECRET`

Optional compose environment:

- `APP_HOST_PORT`, default `8422`
- `PUBLIC_URL`, default `http://localhost:8422`

## Public Routing

The development public host is expected to be `https://fabrique.infinitynode.ai`. The host-side routing stack is outside this repository, but the intended shape is:

```text
Cloudflare DNS
  -> Cloudflare Tunnel
  -> host port 80
  -> Traefik
  -> http://host.docker.internal:8422
  -> fabrique container port 3000
```

When using the public host, set:

```bash
PUBLIC_URL=https://fabrique.infinitynode.ai
```

`PUBLIC_URL` controls the URLs stored in artifact records and shown to users. It does not create host routing by itself.

## Artifacts

Generated HTML previews are written to the configured artifacts directory under a session-specific folder:

```text
artifacts/<session_id>/<artifact_id>.html
```

The Docker stack mounts `./artifacts` into `/app/artifacts`, preserving generated pages across container restarts. Artifact files are served only after the request passes auth and the corresponding session document contains the artifact record.

## Authentication

Fabrique uses a shared password gate. Any authenticated user can access the app surface, sessions, and artifacts. Auth cookies are signed with `FABRIQUE_AUTH_SECRET`; rotating that secret logs everyone out.

This is appropriate for a small private workshop deployment. Do not treat it as per-user authorization.

## Branch Previews

Feature worktrees can be exposed as hot-reload previews using the scripts in `scripts/`. Preview URLs have this shape:

```text
https://<slug>-fabrique.infinitynode.ai
```

Start a preview from the repo root:

```bash
scripts/preview-start <slug> <worktree>
```

The script validates the slug, allocates a stable port in the preview range, writes a systemd user unit named `fabrique-preview-<slug>`, starts `react-router dev`, stores metadata in the preview registry, and prints host-local Traefik/cloudflared snippets for the operator.

The generated service sets:

- `NODE_ENV=development`
- `PUBLIC_URL=https://<slug>-fabrique.infinitynode.ai`
- `ARTIFACTS_DIR=<project>/dev/artifacts` by default, or `FABRIQUE_PREVIEW_ARTIFACTS_DIR` when set before starting the preview
- `FABRIQUE_ALLOWED_HOSTS=<slug>-fabrique.infinitynode.ai,dev-fabrique.infinitynode.ai,localhost`

Branch previews intentionally share the development artifact directory because they also share the development Mongo session records. Keeping artifacts in `dev/artifacts` avoids orphaned preview records when a feature worktree has an empty local `artifacts/` directory.

Secrets such as `MONGO_URL`, `ANTHROPIC_API_KEY`, `FABRIQUE_PASSWORD`, and `FABRIQUE_AUTH_SECRET` are read from the preview worktree's `.env` file when present.

## Preview Registry

Preview metadata is stored outside tracked source by default:

```text
${FABRIQUE_PREVIEW_REGISTRY:-$HOME/.local/state/fabrique/previews.json}
```

Each entry records the slug, branch, worktree, assigned port, hostname, systemd service name, creation time, and update time. Existing slugs reuse their registered ports.

Use the companion commands to inspect and clean previews:

```bash
scripts/preview-list
scripts/preview-stop <slug>
scripts/preview-clean [--older-than-days N]
```

`preview-stop` is idempotent. It tolerates an absent registry entry, missing unit file, unavailable stopped service, or already-removed service. It also prints the host-local routes that should be removed if they were added.

`preview-clean` removes entries whose worktree is gone, whose systemd unit is gone, or whose registry timestamp is older than the optional threshold.

## Host-Local Routing For Previews

Preview scripts do not edit Traefik or cloudflared configuration directly. Those files live outside the repo and may require elevated permissions or restarts. Instead, `preview-start` prints snippets equivalent to:

```yaml
http:
  routers:
    fabrique-preview-<slug>:
      rule: Host(`<slug>-fabrique.infinitynode.ai`)
      service: fabrique-preview-<slug>
  services:
    fabrique-preview-<slug>:
      loadBalancer:
        servers:
          - url: http://host.docker.internal:<port>
```

And a cloudflared ingress entry before the catch-all rule:

```yaml
- hostname: <slug>-fabrique.infinitynode.ai
  service: http://localhost:80
```

Create DNS for a preview hostname when needed with the host's configured tunnel:

```bash
cloudflared tunnel route dns <tunnel-id> <slug>-fabrique.infinitynode.ai
```
