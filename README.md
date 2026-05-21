# fabrique

A workshop for making web pages.

You describe a page. Fabrique helps you clarify it, shows you previews,
and publishes the result.

## Status

Founding. Architecture is in flight; first vertical slice not yet built.

## Stack (planned)

- **App shell:** React Router 7 (RR7) monolith
- **Workflow engine:** LangGraph TypeScript runtime, in-process
- **Persistence:** MongoDB — one session per document
- **Artifact storage:** filesystem-backed volume with per-session preview dirs
- **Transport:** `POST` for input events, `SSE` for live session updates

## First vertical slice

1. Create session
2. Submit brief
3. Ingest brief
4. Run clarification gate
5. Interrupt / answer clarification
6. Stream updated state live

## Why "fabrique"

French for *workshop* or *maker's shop* — warmer than *factory*, more
honest than *atelier*. Pages get made here.

## Owners

- **Evan** — product partner
- **Gigi** — orchestrator (config at `~/.config/coda/personalities/gigi`)
