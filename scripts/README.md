# scripts

This directory contains repo-owned operator scripts for Fabrique branch previews. They are intentionally focused on preview lifecycle only; normal app development still uses the package scripts in `package.json`.

## Commands

### `preview-start <slug> <worktree>`

Starts or updates a hot-reload preview for a feature worktree.

The script:

1. Validates that `<slug>` is a lowercase DNS-label-safe value short enough for `<slug>-fabrique.infinitynode.ai`.
2. Verifies `<worktree>` exists and looks like a Fabrique repo root.
3. Requires `pnpm`, `jq`, and a safe systemd-compatible path.
4. Allocates or reuses a port from `${FABRIQUE_PREVIEW_PORT_MIN:-5300}` through `${FABRIQUE_PREVIEW_PORT_MAX:-5399}`.
5. Writes a user systemd unit named `fabrique-preview-<slug>.service`.
6. Starts `pnpm exec react-router dev --host 0.0.0.0 --port <port>` from the target worktree.
7. Records metadata in the preview registry.
8. Prints the host-local Traefik, cloudflared, and DNS snippets needed to route the public hostname.

The generated service loads `<worktree>/.env` if it exists and sets preview-specific defaults for `PUBLIC_URL`, `ARTIFACTS_DIR`, and `FABRIQUE_ALLOWED_HOSTS`.

By default, branch previews share the sibling `dev/artifacts` directory rather than each worktree's local `artifacts/` directory. That keeps feature previews aligned with the shared development Mongo session records, whose artifact URLs point at durable files outside an individual worktree. Override with `FABRIQUE_PREVIEW_ARTIFACTS_DIR=/path/to/artifacts` if the environment uses a global artifact volume.

### `preview-list`

Prints registered previews as a table with slug, branch, port, hostname, service name, and worktree path. If the registry is missing or empty, it exits successfully with a message.

### `preview-stop <slug>`

Stops and removes a preview service and deletes its registry entry.

The command is idempotent: it handles absent services, missing unit files, and missing registry entries without treating them as fatal. When it removes a registry entry, it prints the host-local Traefik and cloudflared routes that should also be removed if they were added.

### `preview-clean [--older-than-days N]`

Reconciles the preview registry and stops stale previews. A preview is stale when its worktree is missing, its systemd unit is missing, or its `updated_at` timestamp is older than the optional age threshold.

Service-existence checks require a reachable `systemd --user`. If user systemd is unavailable, the command warns and skips only that class of check.

## Registry

Preview metadata is stored outside the repo by default:

```text
${FABRIQUE_PREVIEW_REGISTRY:-$HOME/.local/state/fabrique/previews.json}
```

Each entry contains:

- `slug`
- `branch`
- `worktree`
- `port`
- `hostname`
- `service_name`
- `created_at`
- `updated_at`

The registry lets previews reuse stable ports for existing slugs and gives cleanup commands enough information to stop stale services.

## Shared Helpers

`lib/preview-common.sh` holds validation, naming, registry, port allocation, systemd, and host-routing helper functions used by the preview scripts. Keep shared behavior there rather than copying shell logic between commands.

## Package Scripts

`package.json` exposes these commands through pnpm aliases:

```bash
pnpm preview:start <slug> <worktree>
pnpm preview:list
pnpm preview:stop <slug>
pnpm preview:clean [--older-than-days N]
```

Use either the direct script path or the pnpm alias. The direct script path is often clearer for operator docs; the pnpm alias is convenient from habit inside the repo.
