# Supabase Cloud database setup plan

This is a future execution sequence for the Database Developer; no hosted resource was contacted or changed here.

1. Create an isolated Cloud project and record project version, region, Auth redirect settings and least-privilege credentials. Confirm extensions `pgcrypto`, `btree_gist`, `vector`, `pgmq` are available in the target project.
2. Review MVP SQL and contract changes. Rewrite migration 1 first: extensions/private schema, enum types, UUIDv7 function, identity/provider/catalog/project/booking/AI tables and FKs. Use [table specifications](table-specifications.md) and [relationships](relationships.md) as checklists.
3. Add RLS helpers, SELECT policies, triggers and indexes. Review `profiles_read` and public projections for unintended private data. Verify all grants, including RPC revocations.
4. Recreate transaction functions, queue, Storage buckets/policies, Realtime publication and `providers` view. Apply the semantic changes from migrations 3–8 in order; do not copy an intermediate view definition as final.
5. Generate types from the Cloud schema into the shared package in the later implementation phase. Verify vector dimension matches the chosen embedding model and API parser.
6. Run two-account access tests, booking concurrency tests, queue redelivery/budget tests, upload/read tests and migration replay against a disposable Supabase Cloud test project. Record SQL version and results before shared development use. No local Supabase instance is required.

Known dependencies: `profiles` requires Supabase `auth.users`; `studio_members` requires photographers/studios; booking reservation requires services, studios, photographers and schedule; private Storage reads require project/booking/room tables; AI indexing requires portfolio images and pgvector. No complete dataset or storage objects are included in migrations. The generated `packages/shared/src/db.types.ts` on the MVP branch is a snapshot, not a substitute for validating the new Cloud schema.
