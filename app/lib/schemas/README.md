# schemas

This module holds the data contracts used by the graph and its inputs. The schemas are the shape boundary between free-form model output, typed app code, and client events.

## What belongs here

1. Zod schemas for structured LLM output.
2. Zod schemas for input events that arrive from the UI.
3. Type exports inferred from those schemas.

## What does not belong here

1. Business logic.
2. Database access.
3. Prompt text that controls workflow behavior.
4. Any code that mutates session state or writes files.

## How it connects to neighboring modules

Graph nodes use the LLM schemas to force structured output from the model. The input schema gives the review event shape that is stored in session records. These schemas keep the rest of the app from guessing about payload structure.

## Key files and responsibilities

1. `llm/brief.ts`, schema for the structured brief fields produced by ingest.
2. `llm/clarification.ts`, schema for the readiness verdict produced by the clarifier.
3. `llm/preview.ts`, schema for the HTML preview payload produced by the design step.
4. `input/review-preview.ts`, schema for the user review event sent back into the graph.
