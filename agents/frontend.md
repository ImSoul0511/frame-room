# Frontend guide

Read [contribution rules](../docs/contributing.md#frontend), the [API draft](../docs/api/contract_v0.md), and the task.

Use React functions/hooks, Astryx components/tokens, React Router, and TanStack Query. Inspect installed props with `corepack pnpm --filter web astryx component <Name>`; do not run init or recreate root agent files. Keep UI strings separate.

Use shared Zod wire schemas. Never rely on client-only authorization or expose server keys. Keep browser code portable for future Tauri.

Verify loading/error/empty states, 375px/1280px rendering, keyboard access, labels, and actual browser/API responses. Record evidence; infrastructure checks do not prove business features.
