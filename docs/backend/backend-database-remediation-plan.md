# Cloud remediation record and remaining verification

This record summarizes the 24 November 2026 [endpoint and schema audit](endpoint-schema-audit.md). Its counts belong to that review.

## Completed during the review

- Reconciled the November migrations for booking completion, conversations, agreements, catalog and proofing, moderation, access, add-ons and indexes. Follow-up migrations aligned studio foreign keys with profiles, added portfolio source fields, backfilled add-on snapshots, kept the portfolio bucket public and extended the genre enum.
- Rehearsed the November changes in a transaction and rolled it back before applying the upgrades. There were no bookings to backfill on Cloud. Repeating the backfill on local PostgreSQL did not duplicate add-ons.
- Fixed genre filtering and PostgreSQL enum-array responses. Validated photographer, studio and membership responses before commit. Distinguished explicit nulls from omitted fields for nullable updates. Booking creation saved add-on rows and the service snapshot in the same transaction.
- Verified 26 HTTP reads and seven dynamic-query variants against Cloud. The historical local suite reported 266 passing cases. Local PostgreSQL replay used substitutes for hosted Auth, Storage, pgmq and vector services.

## Remaining checks for a disposable Cloud project

1. Replay the migrations on an empty project, then test upgrading older data. Compare constraints, views, foreign keys, triggers, functions, grants, RLS, bucket access and migration history. Regenerate shared database types from the verified schema.
2. Exercise signup, provider and studio edits, album publication, add-on booking, assignment, cancellation, messaging, gallery selection, delivery, notifications and moderation with eligible accounts and an outsider. Include duplicate submissions, stale versions, invalid add-ons and partial failures.
3. Compare booking add-on relations to the original snapshot after a retry. Test nullable field updates, changes to studio membership, the last manager rule and reassignment while a booking is active.
4. Verify public portfolio reads and private Storage and Realtime access with real credentials. SQL preparation alone cannot exercise these permissions. Follow the [Cloud verification guide](../infrastructure/supabase-cloud-preview.md#verification).
5. Record the versions deployed and actual results for each environment, including recovery steps for an interrupted migration. Web and API deployment details belong to the environment being released.
