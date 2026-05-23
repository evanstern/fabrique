# db

This module is the shared Mongo access layer. It exists so the rest of the app can ask for a client or database handle without each feature re-creating its own connection logic.

## What belongs here

1. Mongo client setup.
2. Shared database access helpers.
3. Connection reuse and environment variable checks.

## What does not belong here

1. Collection-specific reads or writes.
2. Session lifecycle rules.
3. Graph workflow logic.
4. Any query that is specific to one product concept instead of the database itself.

## How it connects to neighboring modules

Sessions, graph checkpointing, and any other persistence code call into this module first. The module gives them a `Db` or `MongoClient`, then those callers own the collection names, schema shape, and update rules.

## Key files and responsibilities

1. `mongo.ts`, creates and caches the shared Mongo client, then exposes the database handle.
