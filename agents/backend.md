# Backend guide

Read [contribution rules](../docs/contributing.md#backend), the [API draft](../docs/api/contract_v0.md), and the task.

Separate Fastify construction from listening. Use Node ESM with .js imports. Routes delegate business logic to services and data access to repositories; add modules only when needed.

Validate environment settings and feature inputs. Enforce current membership/booking permissions server-side. Keep writes transactional, follow state machines, redact sensitive logs, and restrict CORS.

Verify injection tests and compiled Node startup. Health is liveness only. Update shared schemas, contract, and OpenAPI when implementing business endpoints.
