# Copilot Cloud Agent Onboarding (fabrique)

## Quick orientation
- Stack: React Router 7 SSR app (`app/`), TypeScript, Vite, Tailwind v4.
- Runtime flow: authenticated web UI + API routes orchestrate a LangGraph workflow and persist session state in MongoDB.
- Core domains:
  - Routing: `app/routes.ts`
  - Workflow graph + interrupts: `app/lib/graph/edges.ts`, `app/lib/graph/nodes/*`
  - Session persistence (Mongo): `app/lib/sessions/*`
  - Auth guard + cookie/sign-in: `app/lib/auth/*`
  - SSE snapshot/progress streaming: `app/lib/stream/*`, `app/routes/api.sessions.$id.stream.tsx`
  - Artifact serving: `app/routes/artifacts.$session_id.$artifact_id.tsx`

## Local setup + validation
- Package manager: `pnpm` (lockfile is `pnpm-lock.yaml`; Dockerfile pins pnpm `10.33.0` via Corepack).
- Install:
  - `corepack enable`
  - `corepack prepare pnpm@10.33.0 --activate`
  - `pnpm install --frozen-lockfile`
- Main validation commands:
  - `pnpm run typecheck`
  - `pnpm run build`
- There is currently no dedicated `test` or `lint` script in `package.json`.

## Environment requirements
Use `.env.example` as the source of truth.

Required:
- `ANTHROPIC_API_KEY`
- `MONGO_URL`
- `FABRIQUE_PASSWORD`
- `FABRIQUE_AUTH_SECRET`

Optional:
- `APP_HOST_PORT` (default `8422`)
- `PUBLIC_URL` (default `http://localhost:8422`)
- `ARTIFACTS_DIR` is read by app code (defaults to `./artifacts`; in Docker it is set to `/app/artifacts`).

## Product/workflow behavior to preserve
- All routes are password-gated via `requireAuth` except the login flow; API routes use `requireAuth(request, { api: true })`.
- Session lifecycle is stage-based (`briefing` → `preview_ready`/`revising` → `published`) in `app/lib/sessions/types.ts`; preserve stage guards in route actions.
- LangGraph interruptions drive user interaction:
  - clarification answers (`answer_clarification`)
  - preview review (`review_preview`)
- Preview artifacts are HTML files persisted under `artifacts/<session_id>/<artifact_id>.html` and referenced through artifact records.
- SSE stream sends both full snapshot updates and `progress` events; keep heartbeat/throttling behavior intact.

## Change guidance
- Prefer small, surgical edits in the corresponding domain file rather than broad refactors.
- Keep API error semantics and status codes stable unless explicitly changing contract.
- Maintain strict input validation (e.g., zod schemas, event parsing, stage checks).
- Preserve security-sensitive behavior in auth helpers (constant-time comparisons, signed cookie verification, redirect sanitization).

## Deployment context
- Production deploy is GitHub Actions workflow: `.github/workflows/deploy.yml`.
- Workflow is push-to-`main`, self-hosted runner, and `docker compose up -d --build` on host worktree.

## Errors encountered and workarounds
- Error: `pnpm: command not found` when running install in a fresh environment.
- Workaround: enable Corepack and activate pinned pnpm first:
  - `corepack enable`
  - `corepack prepare pnpm@10.33.0 --activate`
