# stream

This module handles the in-memory snapshot and progress broadcast layer for live session updates. It is the bridge between graph execution and the client SSE stream.

## What belongs here

1. Snapshot subscription and publishing.
2. Progress event subscription and publishing.
3. Session snapshot construction for live clients.

## What does not belong here

1. Session document writes.
2. Graph node business logic.
3. Artifact generation.
4. Any persistence layer beyond reading a session for a snapshot.

## How it connects to neighboring modules

The graph publishes progress events while work is running, and the stream layer forwards those events to subscribers. Snapshot building reads the session and pending interrupt state, then publishes the assembled snapshot to any connected client. This keeps the SSE path separate from the workflow logic that produces the data.

## Key files and responsibilities

1. `hub.ts`, stores in-process subscribers and publishes progress or snapshot events.
2. `snapshot.ts`, builds a session snapshot from sessions and graph state, then publishes it.
