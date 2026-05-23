# graph

This module owns the LangGraph workflow for the page-making session. It is the orchestration layer that turns a brief into structured state, preview generation, review, revision, and publish.

## What belongs here

1. Graph state and edges.
2. Prompt text used by the workflow nodes.
3. Node implementations that call the model and update session state.
4. Runtime helpers that support graph execution, progress, and artifact paths.

## What does not belong here

1. HTTP route handlers.
2. Session document persistence helpers that do not belong to the workflow itself.
3. UI rendering.
4. Generic database access code.

## How it connects to neighboring modules

The graph reads and writes through sessions, stores generated preview artifacts through records and the file system, and publishes progress through the stream hub. It is the center of the workflow, but it does not own the storage primitives that it depends on.

## Key files and responsibilities

1. `state.ts`, defines the graph state carried between nodes.
2. `edges.ts`, builds and compiles the workflow and inspects pending interrupts.
3. `prompts.ts`, keeps the system prompts for the model calls.
4. `nodes/`, contains the step implementations for ingest, clarification, preview generation, revision, and publish.
5. `runtime/`, contains helpers for artifact locations and progress publishing.
