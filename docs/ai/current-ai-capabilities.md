# Project AI and catalog search

The web catalog uses names, genres, locations and tags for discovery. The experimental semantic search endpoint, provider grouping and portfolio indexing worker have been removed.

The TypeScript API and worker contain the project assistant, proposed actions, concept generation, editing and culling suggestions. Culling helps a person select proofs for a project. These operations require model credentials and project permissions. Jobs record reservations and execution status. The user confirms proposed changes before they are applied.

The Python service currently exposes a health endpoint. Normal workspace startup runs the TypeScript services. Inspect the [worker](../../apps/api/src/worker.ts) and [business routes](../../apps/api/src/routes/business.ts) for the implemented model paths. The review records in [MVP verification](../../plans/tasks/MVP-001-verification.md) cover their stated environment and do not establish model quality.
