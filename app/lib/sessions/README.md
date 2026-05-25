# sessions

This module owns the session document as the central working record for a page-making run. It is where brief state, workflow stage, and record arrays live together in Mongo.

## What belongs here

1. Session document types and collection name.
2. Create, read, and update helpers for the session document.
3. Brief updates, stage changes, record appends, and published-preview lookup.

## What does not belong here

1. LLM prompts or node orchestration.
2. File-system artifact writing.
3. Stream publishing.
4. Any schema that belongs to records, graph state, or input events.

## How it connects to neighboring modules

Graph nodes call into this module when they need to store the results of a step. Records are appended here, then stream snapshots read the session back out to show the current state to the client. The module stays focused on the canonical Mongo document, not on how that document was produced.

## Key files and responsibilities

1. `types.ts`, defines the session document shape and stage vocabulary.
2. `create.ts`, inserts a new empty session document.
3. `queries.ts`, loads one session by id.
4. `brief.ts`, updates raw brief text and structured brief fields.
5. `records.ts`, appends preview and review records.
6. `stage.ts`, moves a session between workflow stages.
7. `publishing.ts`, resolves the published preview from the stored review trail.
