# auth

This module holds the request-facing authentication helpers for Fabrique. It is the boundary between incoming HTTP requests and the auth secret values used to accept or reject them.

## What belongs here

1. Cookie signing and verification.
2. Login password comparison.
3. Login rate limiting.
4. Request gates, client IP lookup, and redirect sanitizing for auth routes.

## What does not belong here

1. Session document reads and writes.
2. Mongo connection code.
3. UI forms or route components.
4. Any business logic that is not directly about authenticating a request.

## How it connects to neighboring modules

Auth sits at the edge of the app. Routes call these helpers before they hand off to session work, and the helpers depend on environment secrets rather than database state. It does not own persistence. It only decides whether a request is trusted enough to continue.

## Key files and responsibilities

1. `cookies.ts`, signs, verifies, reads, and clears the auth cookie.
2. `password.ts`, compares the submitted password against the configured secret.
3. `rate-limit.ts`, keeps a small in-process login throttle.
4. `request.ts`, enforces auth on requests and normalizes redirect targets.
