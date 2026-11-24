# BE-109: Add-on management

## Impact

| Layer             | Change and compatibility                                                                              | Verification                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| API               | Add owner-only list and update endpoints. Public add-on listing remains active-only.                  | Catalog route tests cover owner access, inactive listing and denied updates.                 |
| Shared validation | Reuse the existing add-on input schema; update requests carry the complete current form.              | API and web TypeScript checks.                                                               |
| Permissions       | Photographer ownership or active studio manager authorization is required before reading or updating. | Route test covers a non-owner; the existing ownership helper applies to both provider types. |
| Database          | Uses existing add-on columns; no migration. Booking snapshots preserve prior prices and names.        | Source inspection; no Cloud writes performed.                                                |
| Web               | List, edit and pause or reactivate add-ons for owned services.                                        | TypeScript and lint; browser interaction remains to be checked.                              |

Changes require the normal API review described in [contributing](../../docs/contributing.md#commits-and-prs).
