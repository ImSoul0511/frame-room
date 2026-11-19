# Supabase Cloud migration workflow

1. Database Developer writes reviewed, ordered SQL in a later implementation session, based on the confirmed MVP source plus approved revisions. Each change specifies forward migration, rollback/repair strategy, grants and test cases.
2. Apply first to a disposable Supabase Cloud test project, then a shared Cloud development project and staging. Compare schema, functions, policies, buckets, publication and generated TypeScript types. Run direct RLS tests and end-to-end workflows against the Cloud test project.
3. Promote the exact reviewed migration set to the shared development project through CI or a controlled CLI process, recording migration IDs and checksums. Restrict who can run destructive reset or push commands.
4. Coordinate incompatible API/schema changes with frontend and worker deployment. Additive columns and dual-read/write transitions may be needed when existing Cloud data exists.

On the designated test project, compare the queued SQL versions with the Cloud
migration history before applying changes. Use the session-pooler connection and
review the dry run. Run the Cloud verification commands after replay.
[Cloud verification](supabase-cloud-preview.md#verification)

```powershell
pnpm exec supabase db push --dry-run --db-url $env:CLOUD_TEST_DATABASE_URL
pnpm exec supabase db push --db-url $env:CLOUD_TEST_DATABASE_URL
pnpm test:db
pnpm db:types:cloud
```

The legacy local commands assume local Supabase. Hosted databases use the
reviewed migration workflow and synthetic records on the disposable project.
