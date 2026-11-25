# Web routes and user journeys

[App.tsx](../../apps/web/src/App.tsx) defines these routes. The web app supports English and Vietnamese.

| Page                   | URL                                                         | Main interaction                                                                                                      |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Home                   | `/home` and `/`                                             | Browse fixed genre samples and open a genre.                                                                          |
| Explore                | `/explore`                                                  | Search by name and filter by location, genre or style. `/search` forwards its query here.                             |
| Directory and genres   | `/photographers`, `/studios`, `/genres/:genre`              | Browse providers and published work.                                                                                  |
| Albums and providers   | `/portfolios/:id`, `/providers/:type/:id`                   | View image captions, tags, album and creator details. Contact a provider or choose a service.                         |
| Registration           | `/auth`, `/auth/callback`, `/reset-password`, `/onboarding` | Sign up, verify email, complete a profile or recover access. Photographers can select one to five genres at signup.   |
| Account                | `/profile`, `/settings`, `/notifications`                   | Manage identity, avatar and notifications.                                                                            |
| Professional workspace | `/portfolio`, `/studio`                                     | Manage collections, services and studio membership according to role.                                                 |
| Projects and bookings  | `/projects`, `/projects/:id`, `/bookings`, `/bookings/:id`  | Prepare a brief, book a provider, collaborate, select proofs and receive delivery.                                    |
| Messaging              | Floating chat and `/messages`                               | Open a compact conversation, expand it with its draft, or switch between direct messages and confirmed booking rooms. |
| Information            | `/about`, `/support`, `/community`, `/privacy`              | Read about FrameRoom, booking help, publishing guidelines and browser storage.                                        |
| Operations             | `/admin`, `/admin/booking-completions`, `/health`           | Moderate, review completions or check API liveness.                                                                   |
