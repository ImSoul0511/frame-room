# Endpoint inventory

Source: `apps/api/src/routes/business.ts` at `feature/MVP-001-ai-focused-workflow` (`66f3779`). Checked out `main` (`a799dea`) has only `GET /health`. “MVP branch only” does not mean deployed. The route source and `packages/shared/src/business.ts` on that branch define validation; `docs/api/contract_v0.md` is historical design.

| Method and path                                         | Input schema                        | Status                                      |
| ------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| `GET /health`                                           | `healthResponseSchema`              | Both branches                               |
| `GET /v1/config`                                        | `none`                              | MVP branch only                             |
| `GET /v1/openapi.json`                                  | `none`                              | MVP branch only                             |
| `POST /v1/me`                                           | `profileInputSchema`                | MVP branch only                             |
| `POST /v1/search`                                       | `searchInputSchema`                 | MVP branch only                             |
| `POST /v1/creative-projects/:id/assistant`              | `assistantInputSchema`              | MVP branch only                             |
| `POST /v1/creative-projects/:id/chat`                   | `stream input`                      | MVP branch only                             |
| `POST /v1/uploads`                                      | `multipart`                         | MVP branch only                             |
| `GET /v1/me`                                            | `empty`                             | MVP branch only                             |
| `GET /v1/photographers`                                 | `empty`                             | MVP branch only; registered in a route loop |
| `GET /v1/photographers/:id`                             | `empty`                             | MVP branch only; registered in a route loop |
| `GET /v1/studios`                                       | `empty`                             | MVP branch only; registered in a route loop |
| `GET /v1/studios/:id`                                   | `empty`                             | MVP branch only; registered in a route loop |
| `PATCH /v1/me`                                          | `schemas.profileInputSchema`        | MVP branch only                             |
| `GET /v1/me/studios`                                    | `empty`                             | MVP branch only                             |
| `GET /v1/me/invitations`                                | `empty`                             | MVP branch only                             |
| `GET /v1/photographers/me`                              | `empty`                             | MVP branch only                             |
| `POST /v1/photographers/me`                             | `schemas.photographerInputSchema`   | MVP branch only                             |
| `PATCH /v1/photographers/me`                            | `schemas.photographerInputSchema`   | MVP branch only                             |
| `GET /v1/explore`                                       | `empty`                             | MVP branch only                             |
| `POST /v1/studios`                                      | `schemas.studioInputSchema`         | MVP branch only                             |
| `PATCH /v1/studios/:id`                                 | `schemas.studioInputSchema`         | MVP branch only                             |
| `GET /v1/studios/:id/team`                              | `empty`                             | MVP branch only                             |
| `POST /v1/studios/:id/invitations`                      | `schemas.invitationInputSchema`     | MVP branch only                             |
| `PATCH /v1/invitations/:id`                             | `schemas.invitationResponseSchema`  | MVP branch only                             |
| `DELETE /v1/studios/:id/members/:userId`                | `empty`                             | MVP branch only                             |
| `PATCH /v1/studios/:id/members/:userId`                 | `inline schema`                     | MVP branch only                             |
| `GET /v1/studios/:id/resources`                         | `empty`                             | MVP branch only                             |
| `POST /v1/studios/:id/resources`                        | `schemas.resourceInputSchema`       | MVP branch only                             |
| `PATCH /v1/resources/:id`                               | `schemas.resourceInputSchema`       | MVP branch only                             |
| `DELETE /v1/resources/:id`                              | `empty`                             | MVP branch only                             |
| `GET /v1/studios/:id/dashboard`                         | `empty`                             | MVP branch only                             |
| `GET /v1/me/services`                                   | `empty`                             | MVP branch only                             |
| `POST /v1/services`                                     | `schemas.serviceInputSchema`        | MVP branch only                             |
| `POST /v1/studios/:id/services`                         | `schemas.serviceInputSchema`        | MVP branch only                             |
| `PATCH /v1/services/:id`                                | `schemas.serviceInputSchema`        | MVP branch only                             |
| `DELETE /v1/services/:id`                               | `empty`                             | MVP branch only                             |
| `GET /v1/services/:id/add-ons`                          | `empty`                             | MVP branch only                             |
| `POST /v1/services/:id/add-ons`                         | `schemas.addOnInputSchema`          | MVP branch only                             |
| `GET /v1/tags`                                          | `empty`                             | MVP branch only                             |
| `GET /v1/me/portfolios`                                 | `empty`                             | MVP branch only                             |
| `GET /v1/portfolios`                                    | `empty`                             | MVP branch only                             |
| `POST /v1/portfolios`                                   | `schemas.portfolioInputSchema`      | MVP branch only                             |
| `POST /v1/studios/:id/portfolios`                       | `schemas.portfolioInputSchema`      | MVP branch only                             |
| `PATCH /v1/portfolios/:id`                              | `schemas.portfolioInputSchema`      | MVP branch only                             |
| `DELETE /v1/portfolios/:id`                             | `empty`                             | MVP branch only                             |
| `GET /v1/portfolios/:id`                                | `empty`                             | MVP branch only                             |
| `POST /v1/portfolios/:id/images`                        | `schemas.portfolioImageInputSchema` | MVP branch only                             |
| `POST /v1/portfolio-images/:id/index`                   | `empty`                             | MVP branch only                             |
| `PATCH /v1/portfolio-images/:id/tags`                   | `inline schema`                     | MVP branch only                             |
| `GET /v1/creative-projects`                             | `empty`                             | MVP branch only                             |
| `POST /v1/creative-projects`                            | `schemas.projectInputSchema`        | MVP branch only                             |
| `GET /v1/creative-projects/:id`                         | `empty`                             | MVP branch only                             |
| `PATCH /v1/creative-projects/:id`                       | `schemas.projectPatchSchema`        | MVP branch only                             |
| `GET /v1/creative-projects/:id/references`              | `empty`                             | MVP branch only                             |
| `GET /v1/creative-projects/:id/artifacts`               | `empty`                             | MVP branch only                             |
| `GET /v1/creative-projects/:id/messages`                | `empty`                             | MVP branch only                             |
| `GET /v1/creative-projects/:id/actions`                 | `empty`                             | MVP branch only                             |
| `POST /v1/ai-actions/:id/confirm`                       | `empty`                             | MVP branch only                             |
| `POST /v1/ai-actions/:id/reject`                        | `empty`                             | MVP branch only                             |
| `GET /v1/creative-projects/:id/ai-jobs`                 | `empty`                             | MVP branch only                             |
| `POST /v1/creative-projects/:id/ai-jobs`                | `schemas.jobInputSchema`            | MVP branch only                             |
| `GET /v1/ai-jobs/:id`                                   | `empty`                             | MVP branch only                             |
| `GET /v1/me/ai-usage`                                   | `empty`                             | MVP branch only                             |
| `GET /v1/bookings`                                      | `empty`                             | MVP branch only                             |
| `POST /v1/bookings`                                     | `schemas.bookingInputSchema`        | MVP branch only                             |
| `GET /v1/bookings/:id`                                  | `empty`                             | MVP branch only                             |
| `POST /v1/bookings/:id/transitions`                     | `schemas.transitionInputSchema`     | MVP branch only                             |
| `PATCH /v1/bookings/:id/schedule`                       | `schemas.scheduleInputSchema`       | MVP branch only                             |
| `GET /v1/bookings/:id/workspace`                        | `empty`                             | MVP branch only                             |
| `POST /v1/bookings/:id/brief-versions`                  | `schemas.briefContentSchema`        | MVP branch only                             |
| `POST /v1/bookings/:id/brief-versions/:briefId/approve` | `empty`                             | MVP branch only                             |
| `POST /v1/shoot-rooms/:id/messages`                     | `schemas.messageInputSchema`        | MVP branch only                             |
| `POST /v1/shoot-rooms/:id/milestones`                   | `schemas.milestoneInputSchema`      | MVP branch only                             |
| `PATCH /v1/shoot-rooms/:id/milestones/:milestoneId`     | `inline schema`                     | MVP branch only                             |
| `POST /v1/shoot-rooms/:id/decisions`                    | `schemas.decisionInputSchema`       | MVP branch only                             |
| `PATCH /v1/shoot-rooms/:id/decisions/:decisionId`       | `inline schema`                     | MVP branch only                             |
| `POST /v1/bookings/:id/gallery-images`                  | `schemas.portfolioImageInputSchema` | MVP branch only                             |
| `POST /v1/bookings/:id/selections`                      | `schemas.selectionInputSchema`      | MVP branch only                             |
| `POST /v1/bookings/:id/selections/reopen`               | `empty`                             | MVP branch only                             |
| `POST /v1/bookings/:id/deliveries`                      | `inline schema`                     | MVP branch only                             |
| `POST /v1/bookings/:id/reviews`                         | `schemas.reviewInputSchema`         | MVP branch only                             |
| `GET /v1/me/timeline`                                   | `empty`                             | MVP branch only                             |
| `GET /v1/me/schedule`                                   | `empty`                             | MVP branch only                             |
| `POST /v1/me/schedule/blocks`                           | `schemas.blockInputSchema`          | MVP branch only                             |
| `DELETE /v1/me/schedule/blocks/:id`                     | `empty`                             | MVP branch only                             |
| `POST /v1/reports`                                      | `schemas.reportInputSchema`         | MVP branch only                             |
| `GET /v1/admin/reports`                                 | `empty`                             | MVP branch only                             |
| `PATCH /v1/admin/reports/:id`                           | `inline schema`                     | MVP branch only                             |
| `POST /v1/admin/moderation`                             | `schemas.reportInputSchema`         | MVP branch only                             |

`/v1/openapi.json` exposes request schemas but omits detailed success shapes. The special upload and chat handlers need separate handling.
