# Authorization matrix

Derived from MVP `apps/api/src/services/access.ts`, `supabase/migrations/20261030000100_mvp_core.sql`, and `docs/db/mvp.md` on the feature branch. Reconfirm with product before implementation.

| Actor                             | Public catalog                | Own profile/project | Studio management                              | Booking/room                                     | Admin              |
| --------------------------------- | ----------------------------- | ------------------- | ---------------------------------------------- | ------------------------------------------------ | ------------------ |
| Anonymous                         | Published visible reads       | None                | None                                           | None                                             | None               |
| Verified client                   | Public + authenticated search | Own                 | None unless also manager                       | Own client booking and eligible selection/review | Report only        |
| Photographer                      | Public + own catalog          | Own                 | Member read; manager write if role             | Currently assigned personal/studio booking       | Report only        |
| Current studio manager            | Public + own studio           | Own                 | Team, invites, catalog, resource and dashboard | Current studio booking                           | Report only        |
| Removed/unassigned member         | Public                        | Own                 | None                                           | No private room authority                        | Report only        |
| Manually provisioned system admin | Public plus moderation        | Own                 | No implicit studio authority                   | No blanket private room read                     | Reports/moderation |

Auth signup metadata and display specialty never grant role. `photographer` follows a photographer row; `studio_manager` follows a current studio membership; `system_admin` follows manually provisioned `user_roles`. Every owner test needs an unrelated-user denial test. Service role access in a test does not establish RLS correctness. Private Storage and Realtime reads must apply the same current participation rule. Already issued signed URLs remain usable until expiry.
