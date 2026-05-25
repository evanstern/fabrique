# fabrique

Fabrique is a small, password-gated workshop for turning a plain-language page brief into a finished, self-contained HTML page. A user describes the page they want, Fabrique clarifies the brief when needed, generates a preview, streams progress back to the browser, collects approval or revision notes, and publishes the selected result as an artifact URL.

The product is intentionally narrow: make one web page well, keep the workflow reviewable, and leave a durable record of the brief, generated previews, review decisions, and published artifact.

## What It Does

1. Accepts a page brief from the home screen or sessions API.
2. Stores a session document in MongoDB with the brief, workflow stage, records, and generated artifacts.
3. Runs a LangGraph workflow that refines the brief, asks clarification questions when the brief is not ready, generates a self-contained HTML preview, and waits for review.
4. Streams session snapshots and progress events to the browser over Server-Sent Events.
5. Saves generated HTML files under the artifacts directory and serves approved artifacts through authenticated routes.
6. Supports revision loops until the user approves a preview for publishing.

## Stack

- **Application:** React Router 7, React 19, Vite, Tailwind CSS 4
- **Workflow:** LangGraph TypeScript with MongoDB checkpointing
- **LLM:** Anthropic via LangChain structured output
- **Persistence:** MongoDB for sessions and graph checkpoints
- **Artifacts:** Filesystem-backed HTML artifacts, one directory per session
- **Transport:** Form posts and JSON API events for input, SSE for live session state
- **Deployment:** Docker production build plus repo-owned branch preview scripts

## Workflow Shape

Sessions move through the stage vocabulary defined in `app/lib/sessions/types.ts`:

- `briefing`: initial brief capture and clarification
- `designing`: preview generation is in progress
- `preview_ready`: a generated preview is ready for approval or revision notes
- `revising`: the workflow is applying review feedback
- `published`: the selected preview has been approved and no more events are accepted

The graph itself is assembled in `app/lib/graph/edges.ts`:

```text
ingest_brief
  -> ask_questions
     -> ingest_brief (needs more brief detail)
     -> generate_previews (ready)
  -> request_preview_decision
     -> ask_questions -> apply_revision -> request_preview_decision (revise)
     -> publish_selected_preview (approve)
```

Generated previews must be complete HTML documents with inlined CSS and JavaScript. The app does not depend on external assets, stylesheets, scripts, or remote fonts for generated artifacts.

## Getting Started

Install dependencies with pnpm:

```bash
pnpm install
```

Create local environment configuration:

```bash
cp .env.example .env
```

Fill in the required values:

- `ANTHROPIC_API_KEY`: Anthropic API key used by LLM workflow nodes.
- `MONGO_URL`: MongoDB connection string. Atlas is the expected development path.
- `MONGO_DB`: MongoDB database name, for example `fabrique`.
- `FABRIQUE_PASSWORD`: shared password for the app gate.
- `FABRIQUE_AUTH_SECRET`: HMAC secret for signed auth cookies. Generate with `openssl rand -hex 32`.

Optional values:

- `APP_HOST_PORT`: host port for the Docker container, default `8422`.
- `PUBLIC_URL`: base URL used when creating artifact links.
- `ARTIFACTS_DIR`: local artifact directory for non-Docker runs, default `./artifacts`.

## Development

Run the React Router dev server:

```bash
pnpm dev
```

Typecheck the app:

```bash
pnpm typecheck
```

Build the production bundle:

```bash
pnpm build
```

Start the built server after a successful build:

```bash
pnpm start
```

## Running With Docker

The compose stack builds the production app and serves it on `${APP_HOST_PORT:-8422}` while mounting `./artifacts` into the container:

```bash
docker compose build
docker compose up -d
docker compose logs -f app
```

MongoDB is external to the compose stack. Use the Atlas setup guide in `docs/development.md` for the expected development database path.

## Branch Previews

The `scripts/` directory contains operator commands for hot-reload branch previews on `*.fabrique.infinitynode.ai` hostnames:

```bash
pnpm preview:start <slug> <worktree>
pnpm preview:list
pnpm preview:stop <slug>
pnpm preview:clean [--older-than-days N]
```

See `scripts/README.md` for the command contract and `docs/deployment.md` for the host routing model.

## Project Map

- `app/routes/`: React Router pages and API routes.
- `app/lib/auth/`: password gate, signed cookies, request auth helpers, and rate limiting.
- `app/lib/db/`: shared Mongo client and database access.
- `app/lib/sessions/`: canonical session document types and persistence helpers.
- `app/lib/graph/`: LangGraph workflow, nodes, prompts, interrupts, and runtime helpers.
- `app/lib/records/`: artifact, preview, and review record types.
- `app/lib/stream/`: live snapshot and progress event broadcasting for SSE clients.
- `app/lib/schemas/`: Zod contracts for model output and user input events.
- `docs/`: project-level development and deployment documentation.
- `scripts/`: preview environment operator scripts.

## Documentation

- `docs/README.md`: documentation index and reading order.
- `docs/development.md`: local environment, database setup, workflow commands, and troubleshooting.
- `docs/deployment.md`: production container shape, public routing, and branch preview hosting.
- `scripts/README.md`: preview script behavior, inputs, generated state, and cleanup rules.

## Why "fabrique"

French for workshop or maker's shop: warmer than factory, more practical than atelier. Pages get made here.
