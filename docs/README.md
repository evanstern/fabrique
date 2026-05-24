# Documentation

Fabrique's project-level docs live here. The root README gives the high-level product and repository map; these files go deeper on development and deployment workflows.

## Start Here

1. `../README.md` for the product overview, stack, commands, workflow shape, and project map.
2. `development.md` for local setup, environment variables, MongoDB Atlas, the dev loop, and source boundaries.
3. `deployment.md` for the production container, public routing, artifact storage, auth assumptions, and branch previews.
4. `../scripts/README.md` for the preview script command contract and registry behavior.

## What Belongs Here

- Development setup that applies across contributors or worktrees.
- Deployment and operator notes that are too detailed for the root README.
- Project-level architecture explanations that span multiple modules.

## What Does Not Belong Here

- Module-local boundary docs. Keep those next to the code under `app/lib/**/README.md`.
- Secrets or host-local credentials.
- Temporary planning notes, card references, or stale roadmap status updates.

When a doc describes an environment-specific process, prefer stable concepts and commands over hardcoded host paths unless the host path itself is the thing being documented.
