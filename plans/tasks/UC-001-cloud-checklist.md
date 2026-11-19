# UC-001 Cloud acceptance checklist

Use this checklist to verify the application against the [RUP specification](../../rup_ucspec-v2.docx.md)
and the [UC-001 implementation plan](UC-001.md). Check a use case after its
main flow and failure checks pass. Record failing steps with the actor, route,
HTTP status, actual result and relevant test record IDs. Keep credentials,
session tokens and signed media URLs out of the evidence.

## Prepare the Cloud test project

- [ ] Use a disposable Supabase Cloud project. Review and apply the migration
      dry run in order, including the booking completion migration.
      [Migration workflow](../../docs/infrastructure/migration-workflow.md)
- [ ] Point the API and browser to the same Cloud test project. Configure the
      server PostgreSQL connection, Auth redirect allowlist and Cloud test
      environment variables. Set `AI_SEARCH_ENABLED=false`.
      [Cloud setup](../../docs/infrastructure/supabase-cloud-preview.md)
- [ ] Prepare separate browser contexts for one Client, one solo Photographer,
      one Studio Manager, two Studio Photographers, one System Administrator
      and one unrelated verified account. Keep one anonymous context for
      public catalog and access checks.
- [ ] Prepare one published solo package, one published Studio package, a Studio
      resource, two eligible Studio members, and a deliberately overlapping
      schedule block. Prepare a draft and a published portfolio, valid images,
      an unsupported file and an image over 50 MB.
- [ ] Prepare separate bookings for the solo flow, Studio flow, schedule
      conflict, each cancellation branch, manual completion and automatic
      completion. Write down fixture IDs so results can be traced after reload.
- [ ] Start `pnpm dev` and `pnpm dev:worker`. Run `pnpm check`,
      `pnpm test:db` and `pnpm test:e2e` with the Cloud test configuration.
      Confirm whether Playwright ran the private journey or only the smoke
      tests. Record the commit and the applied migration range.

## Accounts and catalog

### UC11 Log in

- [ ] Sign in separately as Client, Photographer, Studio Manager and Admin.
      Check the landing page for each role and reload it.
- [ ] Open a protected URL while signed out. Sign in and confirm the intended
      route and query survive. Try an external return URL and confirm the app
      stays on its own origin.
- [ ] Try an incorrect email or password, an expired session and a Studio
      dashboard managed by someone else. Check the generic credential error
      and the denial of protected data.

### UC13 Register account

- [ ] Register a new Client and Photographer with different synthetic
      addresses. Confirm each email and finish onboarding. Check the success
      screen and the derived roles on the next login.
- [ ] Retry a duplicate email and submit invalid or mismatched credentials.
      Confirm no extra Auth account or application profile is created.
- [ ] In the Photographer onboarding flow, interrupt the request after the
      account profile is created and before the Photographer record succeeds.
      Resume with the same account and check that the selected role and Auth ID
      are retained and only one Photographer record exists.

### UC7 Set up Photographer profile

- [ ] In account settings, save biography, location, valid contact email,
      specialties, genres and styles. Reload and confirm the saved values.
      Compare public catalog data and confirm portfolio and package tools are
      available.
- [ ] Retry on an existing profile and submit invalid data. Try modifying a
      different account. Verify that specialties grant no Studio or Admin
      authority.
- [ ] Fetch the public Photographer by encoded display name and UUID. The
      records must match. Check an unknown name returns 404 and two public
      Photographers sharing the exact name return 409.

### UC4 Create Studio

- [ ] Create a Studio with name, location, address and contact email. Check
      dashboard routing, persistence after reload and the creator's Manager
      membership.
- [ ] Submit an invalid contact address and abandon an edited form. Verify no
      Studio or membership is created. Confirm a Client without a Photographer
      profile cannot create a Studio.

### UC5 Manage Studio members

- [ ] Search for a Photographer and send an invitation. Open it in the
      recipient's context. Accept one invitation and decline another. Check
      membership, status, notifications and the recorded response time.
- [ ] Try inviting a current member or someone already invited. Promote and
      demote a member, then check the changed access and audit record. Try
      demoting the last Manager and modifying an unrelated Studio.
- [ ] Attempt to remove an assigned Photographer. Open the affected-booking
      link, resolve the assignment using UC16, then retry removal. Check that
      previous contributions remain and removed management access is denied.

### UC6 Upload Photographer or Studio portfolio

- [ ] Create a personal draft and a Studio draft. Try publishing without a
      valid image. Add an image, provenance, style tags and optional crew
      credits. Publish and check the public provider and portfolio pages.
- [ ] Try an invalid file and a file over 50 MB. Check that earlier valid
      images and draft fields remain. Verify that anonymous users cannot open
      draft media and a Studio Photographer without Manager authority cannot
      publish under that Studio.

### UC8 Manage service packages

- [ ] Publish a personal package and a Studio package with price, duration,
      deliverables, selection quota and revision limit. Check both public
      service lists and the booking form.
- [ ] After creating a booking, edit and unpublish its package. Confirm the
      public booking option changes and the existing booking keeps its frozen
      package terms. Try invalid terms and a write to an unrelated Studio.

## Contact and booking

### UC17 Chat with a Photographer or Studio

- [ ] Select Contact from a public profile while signed out. Sign in and check
      the provider thread opens. Contact the same provider from two tabs and
      confirm both reach the same thread with its history.
- [ ] Exchange a message and a supported file between Client and provider.
      Reload, load an earlier page of messages, then disconnect and reconnect.
      Retry the same submission ID and confirm there is one stored message.
- [ ] Try empty text, an unsupported file and an image over 50 MB. Check the
      visible error and preservation of the other draft fields. Verify an
      unrelated user cannot read the thread or its attachments.
- [ ] Create two bookings for the same Client and provider. Verify that the
      thread includes authorized booking history. An assigned Studio
      Photographer must see only their booking slice and files.

### UC1 Create Shoot Brief and book

- [ ] Start from a published solo or Studio package. Enter scope, schedule,
      logistics and references, then submit. Verify a pending booking, Brief
      v1 and Client approval exist together. The provider receives a
      notification. Check that an existing Conversation is linked and a
      request without a Conversation creates no room or chat thread.
- [ ] Request a revision and submit a new brief. Attempt to approve or confirm
      against the older version. Approve the latest version and, for a Studio,
      complete UC10 before confirming. Verify one agreed version and one room.
- [ ] Submit missing or invalid scope and a past or reversed time range. Check
      that entered values remain and no booking is created. Decline a separate
      request as provider and cancel another as Client. Verify reasons, audit,
      notifications and absence of a room.
- [ ] Attempt concurrent confirmations competing for a Photographer or Studio
      resource. Verify a single valid reservation and room for the successful
      request and a scheduling error for the other request.

### UC10 Assign Photographer to Studio booking

- [ ] As the Studio Manager, approve the latest Client-approved brief and
      inspect eligible Photographers and availability. Assign one and check the
      booking stays pending. Verify the assignment notification and audit.
- [ ] Try assignment before both approvals, with a stale booking version, with
      an unavailable or ineligible Photographer and as an unrelated user.
      Confirm that none of these attempts creates a room or changes the assignee.

## Shoot Room and delivery

### UC2 Collaborate in Shoot Room

- [ ] Open an eligible booking in Client and provider contexts. Compare the
      agreed brief, reference downloads, booking messages and milestones.
      Check that a message or milestone does not start service. Start service
      explicitly as provider and check the status change.
- [ ] Send a message and attachment and update a milestone. Verify the author
      and server timestamp. Repeat each action at least 20 times and record
      send-to-visible latency in the other context. Sort the measurements and
      take the value at rank `ceil(0.95 × count)`. Check p95 is at most one second
      for each action.
- [ ] Reject one scope proposal and approve another from the other party's
      context. Check that terms change only after approval and that the
      previous version and decisions remain visible.
- [ ] Propose cancellation and decline it in one booking. Accept it in
      another. Verify status, actor, reason and history. Check that a
      non-participant and a user in an ineligible booking state cannot
      collaborate, receive protected events or fetch files.

### UC16 Reassign Studio Photographer

- [ ] In a confirmed or in-progress Studio booking, assign a replacement with a
      reason. Check the old and new IDs, Manager identity and timestamp in the
      audit and verify notifications to all affected users.
- [ ] Open the same room and previously recorded attachment reference in the
      old and new assignee contexts. Check access was revoked for the prior
      assignee unless they have an independent authorized role. Check the
      replacement cannot access the general Client–Studio thread.
- [ ] Try an unavailable replacement, stale version and direct assignee change
      through rescheduling. Verify the existing assignee, reservations, brief,
      booking status and room stay consistent.

### UC3 Proof, annotate and approve photos

- [ ] In an in-progress booking, upload previews and open selection. Check
      protected, watermarked previews. Select photos within quota, attach a
      general note and place a coordinate pin. Compare the pin position at
      desktop and mobile widths after reload.
- [ ] Try submitting above quota and uploading a final before the Client
      submits. Request a revision, reopen as provider and check round history.
      Exhaust the revision limit and verify another round is denied.
- [ ] Deliver at least one valid final file for the submitted round. Verify
      the Client can download it and the unrelated account cannot. Confirm
      receipt and check completion enables one review. Exercise mutual
      cancellation in a separate proofing booking before delivery.
- [ ] On a second delivery, test expiry with the completion worker running.
      Verify the 168-hour deadline, apply a dispute hold and verify the worker
      skips the held booking. Release the hold and verify the remaining time
      resumes. On the disposable project, use a controlled fixture deadline
      or wait for expiry, then confirm a single automated completion and audit
      entry even if manual confirmation races the worker.

## Reports and reviews

### UC15 Report content or review

- [ ] Submit a reason and optional detail for a public portfolio, an image and
      a review. Check each report appears pending in a separate Admin context
      and the targets are still visible.
- [ ] Try an invalid reason, a draft or hidden target and a target removed
      during reporting. Confirm validation preserves the form and no report
      is created for an unavailable target.

### UC14 Moderate reports and reviews

- [ ] Open the queue and evidence as Admin. Hide one target, dismiss one
      report and defer one. Check status, visibility, reason, administrator
      and server timestamp. Verify a hidden image fails via its public media
      URL and a hidden review is excluded from rating totals.
- [ ] Try queue and decision routes from a non-Admin context. Reassess one
      revised review, approving one and rejecting another. Confirm the same
      review IDs remain and only the approved review contributes to ratings.

### UC12 Review a Photographer or Studio

- [ ] Submit one review after manual completion and another after automatic
      completion on separate bookings. Check ratings and association with the
      solo Photographer or both the Studio and assigned Photographer.
- [ ] Try a premature review, a non-owner submission, a duplicate and an
      out-of-range score. Check that hidden and soft-deleted records also
      prevent duplicate reviews.
- [ ] Have Admin hide a review with a reason. Review the reason as Client,
      edit and resubmit it. Verify that the original ID stays hidden until
      Admin approval and its rating returns only after approval.

## UC9 AI Search scope

- [ ] With AI Search disabled, verify anonymous keyword browsing and filters
      can still open public provider pages and their authentication entry
      points. Record AI-assisted ranking as out of scope for UC-001.
