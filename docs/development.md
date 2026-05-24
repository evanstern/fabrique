# Development Guide

This guide covers the local development loop for Fabrique: environment variables, MongoDB setup, workflow commands, and the runtime surfaces most often touched while building features.

## Prerequisites

- Node 20 or newer.
- pnpm, managed through Corepack in the Docker image and expected locally.
- MongoDB connection string. MongoDB Atlas is the expected dev path.
- Anthropic API key for graph nodes that call the model.
- A shared app password and auth cookie secret.

## Environment

Create a local environment file from the tracked template:

```bash
cp .env.example .env
```

Required values:

- `ANTHROPIC_API_KEY`: used by the LangGraph nodes that ingest briefs, clarify readiness, generate previews, and revise previews.
- `MONGO_URL`: MongoDB connection string, including the `fabrique` database name.
- `FABRIQUE_PASSWORD`: shared password required to access the app.
- `FABRIQUE_AUTH_SECRET`: HMAC secret for auth cookies. Generate with `openssl rand -hex 32`.

Optional values:

- `APP_HOST_PORT`: host port used by Docker Compose, default `8422`.
- `PUBLIC_URL`: base URL used when building artifact links, default `http://localhost:8422` in the example env.
- `ARTIFACTS_DIR`: filesystem directory for generated HTML artifacts outside Docker, default `./artifacts`.
- `FABRIQUE_ALLOWED_HOSTS`: comma-separated extra Vite dev-server hosts. Preview scripts set this automatically for branch previews.

Do not commit `.env`; it is local secret material.

## MongoDB Atlas

Fabrique expects MongoDB for session documents and LangGraph checkpointing. Atlas free tier is sufficient for development and avoids relying on local MongoDB availability.

Create an Atlas project and free cluster, then add a database user with read/write access. Build the connection string with the database name in the path:

```text
mongodb+srv://fabrique-app:<password>@<cluster-host>/fabrique?retryWrites=true&w=majority
```

For early development, an Atlas network rule of `0.0.0.0/0` is acceptable when paired with a strong database user password. Tighten the allowlist for production or shared environments when the hosting IPs are stable.

You can sanity-check the connection with `mongosh` if it is installed:

```bash
mongosh "$MONGO_URL"
```

## Install And Run

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Run type generation and TypeScript checks:

```bash
pnpm typecheck
```

Build the production bundle:

```bash
pnpm build
```

Serve the built app:

```bash
pnpm start
```

## Docker Loop

The Docker image builds the React Router production bundle and runs `pnpm start`. Compose injects required secrets from `.env`, maps `${APP_HOST_PORT:-8422}` to container port `3000`, and mounts `./artifacts` to `/app/artifacts`.

```bash
docker compose build
docker compose up -d
docker compose logs -f app
docker compose down
```

MongoDB is not included in `docker-compose.yml`; use `MONGO_URL` for Atlas or another reachable MongoDB instance.

## Development Flow

The browser flow starts at `/`, where an authenticated user submits a page brief. The home action creates a session and redirects to `/s/:session_id` with the initial brief. The session page posts events to `/api/sessions/:id/events` and subscribes to `/api/sessions/:id/stream` for live snapshots and progress.

The main event types are:

- `submit_brief`: starts graph execution for a new brief.
- `answer_clarification`: resumes the graph after clarification questions.
- `review_preview`: approves a generated preview or requests revisions.

Generated artifacts are written under `${ARTIFACTS_DIR:-./artifacts}/<session_id>/<artifact_id>.html` and served through `/artifacts/:session_id/:artifact_id` after auth and session-record checks.

## Module Boundaries

- Routes own HTTP parsing, redirects, auth gates, and response shape.
- `app/lib/sessions` owns the canonical Mongo session document.
- `app/lib/graph` owns workflow orchestration, prompts, nodes, and interrupts.
- `app/lib/stream` owns in-process SSE snapshot and progress delivery.
- `app/lib/records` owns artifact, preview, and review record shapes.
- `app/lib/schemas` owns Zod contracts at model and user-input boundaries.

Each library subdirectory has a README with its local boundary and key files.

## Troubleshooting

- Missing `MONGO_URL`, `ANTHROPIC_API_KEY`, `FABRIQUE_PASSWORD`, or `FABRIQUE_AUTH_SECRET` will fail at runtime when the relevant boundary is reached.
- If generated artifact links point at the wrong host, check `PUBLIC_URL`.
- If Vite rejects a preview hostname, add it through `FABRIQUE_ALLOWED_HOSTS` or start the preview through `scripts/preview-start`.
- If the session page stops updating, check the `/api/sessions/:id/stream` SSE request and server logs for graph or Mongo errors.
