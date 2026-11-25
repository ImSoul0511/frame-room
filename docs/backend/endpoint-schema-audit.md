# Cloud endpoint and schema audit, 24 November 2026

This audit compared Fastify queries with the Cloud PostgreSQL schema through the session pooler. The initial scan prepared 216 static queries successfully, found 53 failures, and skipped three dynamic queries. Most failures shared a small number of missing columns or tables. The final scan after migration prepared all 270 static queries it examined. The three dynamic queries were outside that scan.

## Findings and repairs

| Workflow                          | Issue in the initial scan                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery                         | A genre enum was compared with the provider view's text array. Genre-filtered discovery and the sample photographer and portfolio detail reads returned HTTP 200 after the fix.          |
| Photographer, studio and services | Contact fields, professional roles, selection quotas and revision limits were missing. Enum arrays needed normalization for the PostgreSQL driver. Studio team links reference profiles. |
| Portfolio images                  | Registration and detail queries expected provenance, license and crew fields. The suggested genre migration added support for all twelve genres.                                         |
| Bookings and agreements           | Request keys, agreement revision state, cancellation records, notifications, completion deadlines and hold functions were missing.                                                       |
| Conversations and rooms           | Conversation tables, access functions, message submission IDs and milestone audit columns were missing.                                                                                  |
| Proofing, delivery and moderation | Gallery revisions, photo feedback, delivery round and moderation decisions required the November migrations. Confirmed AI actions used the same affected booking services.               |

The audit recorded all eight November business migrations and the follow-up migrations through `20261124000500` as applied by the end of that review. The portfolio bucket was public. The [ordered migrations](../../supabase/migrations) contain the upgrade SQL.

## Verification boundary

The final read-only pass used Fastify injection against Cloud, with test identities. All 26 HTTP checks and seven dynamic-query variants returned their expected status. Anonymous and authenticated read checks covered available data, including 37 portfolios and 1,335 published images. One public image URL returned HTTP 200.

The available fixtures did not establish cross-account isolation for bookings, conversations or private files. Real Auth, write paths, rollback, Storage access by participant and full booking journeys require a designated test project. See the [follow-up record](backend-database-remediation-plan.md).
