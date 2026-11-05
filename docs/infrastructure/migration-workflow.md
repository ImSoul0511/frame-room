# Future migration workflow

1. Database Developer writes reviewed, ordered SQL in a later implementation session, based on the confirmed MVP source plus approved revisions. Each change specifies forward migration, rollback/repair strategy, grants and test cases.
2. Apply first to a disposable Supabase Cloud test project, then a shared Cloud development project and staging. Compare schema, functions, policies, buckets, publication and generated TypeScript types. Run direct RLS tests and end-to-end workflows against the Cloud test project.
3. Promote the exact reviewed migration set to the shared development project through CI or a controlled CLI process, recording migration IDs and checksums. Restrict who can run destructive reset or push commands.
4. Coordinate incompatible API/schema changes with frontend and worker deployment. Additive columns and dual-read/write transitions may be needed when existing Cloud data exists.

The MVP local commands `pnpm db:start`, `db:stop`, `db:status`, `db:reset`, `db:types` and `demo:configure` assume local Supabase. `scripts/db-types.mjs` contains `--local`; DevOps must redesign it for Cloud type generation. `supabase/config.toml` is historical reference only. The target workflow must not invoke local Supabase commands. Do not run `db:reset` on a hosted project; recreate a disposable Cloud test project through an explicit, reviewed process when a clean slate is required. This document specifies future operations only.
