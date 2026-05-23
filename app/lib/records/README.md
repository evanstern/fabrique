# records

This module defines the small record objects that live inside a session document, plus helpers for record ids and artifact URLs. These records are the durable trail of what the workflow generated and what the user chose.

## What belongs here

1. Artifact, preview, and review record types.
2. Sequential ids for those records.
3. Artifact access URL helpers.

## What does not belong here

1. Mongo persistence code.
2. Session lifecycle updates.
3. Graph state or interrupt handling.
4. Any data that is not part of the session record trail.

## How it connects to neighboring modules

Sessions stores arrays of these record types. Graph nodes create them after generating previews or capturing review input. Stream snapshots read them back out of the session document, and the artifact URL helper gives the browser a stable path to the generated HTML file.

## Key files and responsibilities

1. `artifact.ts`, defines artifact records and builds the browser access URL.
2. `preview.ts`, defines preview records that point at artifacts.
3. `review.ts`, defines review records with the user action and notes.
4. `ids.ts`, creates short sequential ids for records.
