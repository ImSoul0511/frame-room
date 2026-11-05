# MVP ERD

Confirmed foreign keys from the MVP branch migration SQL. `auth_users` represents managed `auth.users`.

```mermaid
erDiagram
  auth_users {
    uuid id
  }
  profiles {
    uuid id
    text user_name
    text display_name
    text avatar_path
    timestamptz created_at
    timestamptz updated_at
  }
  user_roles {
    uuid user_id
    text role
    timestamptz granted_at
  }
  photographers {
    uuid id
    uuid user_id
    text display_name
    text bio
    text city
    text district
    public_genre__ genres
    text__ styles
    boolean is_hidden
    timestamptz created_at
    timestamptz updated_at
  }
  studios {
    uuid id
    text name
    text description
    text city
    text district
    text address
    public_genre__ genres
    uuid created_by
    boolean is_hidden
    timestamptz deleted_at
    timestamptz created_at
    timestamptz updated_at
  }
  studio_members {
    uuid studio_id
    uuid user_id
    public_studio_member_role role
    timestamptz joined_at
  }
  studio_invitations {
    uuid id
    uuid studio_id
    uuid photographer_id
    public_studio_member_role role
    public_invitation_status status
    uuid invited_by
    timestamptz responded_at
    timestamptz created_at
    timestamptz updated_at
  }
  services {
    uuid id
    public_provider_type owner_type
    uuid photographer_id
    uuid studio_id
    text name
    text description
    public_genre genre
    integer duration_minutes
    integer price
    integer photo_count
    integer retouched_count
    boolean is_active
    timestamptz deleted_at
    timestamptz created_at
    timestamptz updated_at
  }
  service_add_ons {
    uuid id
    uuid service_id
    text name
    text description
    integer price
    boolean is_active
    timestamptz deleted_at
    timestamptz created_at
    timestamptz updated_at
  }
  studio_resources {
    uuid id
    uuid studio_id
    text name
    public_resource_type type
    text description
    boolean is_active
    timestamptz deleted_at
    timestamptz created_at
    timestamptz updated_at
  }
  portfolios {
    uuid id
    public_provider_type owner_type
    uuid photographer_id
    uuid studio_id
    text title
    text description
    public_genre genre
    public_portfolio_status status
    timestamptz published_at
    timestamptz deleted_at
    timestamptz created_at
    timestamptz updated_at
  }
  portfolio_images {
    uuid id
    uuid portfolio_id
    text storage_path
    integer width
    integer height
    text caption
    public_provenance provenance
    integer sort_order
    boolean is_hidden
    text source
    timestamptz collected_at
    text license_note
    timestamptz created_at
    timestamptz updated_at
  }
  tags {
    uuid id
    text slug
    text name
    public_tag_kind kind
  }
  image_tags {
    uuid portfolio_image_id
    uuid tag_id
    text source
    real confidence
  }
  creative_projects {
    uuid id
    uuid owner_id
    text title
    text idea
    jsonb brief
    text__ reference_paths
    integer version
    timestamptz created_at
    timestamptz updated_at
  }
  bookings {
    uuid id
    uuid client_id
    uuid project_id
    uuid service_id
    public_provider_type owner_type
    uuid photographer_id
    uuid studio_id
    uuid assigned_photographer_id
    public_booking_status status
    timestamptz scheduled_start
    timestamptz scheduled_end
    integer total_price
    text service_name
    jsonb service_snapshot
    text note
    integer version
    integer agreed_brief_version
    timestamptz created_at
    timestamptz updated_at
    and check((owner_type='photographer'
  }
  schedule_entries {
    uuid id
    uuid booking_id
    uuid photographer_id
    uuid resource_id
    tstzrange during
    text label
    timestamptz created_at
    isempty_during_ check(not
  }
  booking_resources {
    uuid booking_id
    uuid resource_id
    text name
    public_resource_type type
  }
  brief_versions {
    uuid id
    uuid booking_id
    integer version
    jsonb content
    uuid created_by
    boolean client_approved
    boolean provider_approved
    timestamptz created_at
  }
  shoot_rooms {
    uuid id
    uuid booking_id
    text status
    timestamptz created_at
  }
  room_messages {
    uuid id
    uuid room_id
    uuid sender_id
    text text
    text storage_path
    text type
    boolean is_hidden
    timestamptz created_at
  }
  room_decisions {
    uuid id
    uuid room_id
    text title
    text description
    uuid proposed_by
    text status
    timestamptz created_at
    timestamptz updated_at
  }
  room_milestones {
    uuid id
    uuid room_id
    text title
    timestamptz due_at
    text status
    uuid created_by
    timestamptz created_at
    timestamptz updated_at
  }
  galleries {
    uuid id
    uuid booking_id
    text status
    integer round
    timestamptz created_at
    timestamptz updated_at
  }
  gallery_images {
    uuid id
    uuid gallery_id
    text storage_path
    text caption
    public_provenance provenance
    integer width
    integer height
    timestamptz created_at
  }
  gallery_selections {
    uuid gallery_id
    uuid image_id
    integer round
    uuid selected_by
    timestamptz created_at
  }
  deliveries {
    uuid id
    uuid booking_id
    text storage_path
    text file_name
    text mime_type
    timestamptz created_at
  }
  reviews {
    uuid id
    uuid booking_id
    uuid author_id
    uuid photographer_id
    uuid studio_id
    integer rating
    text comment
    boolean is_hidden
    timestamptz deleted_at
    timestamptz created_at
    timestamptz updated_at
  }
  content_reports {
    uuid id
    uuid reporter_id
    text target_type
    uuid target_id
    text reason
    text description
    text status
    timestamptz created_at
    timestamptz updated_at
  }
  ai_messages {
    uuid id
    uuid project_id
    uuid user_id
    text role
    text content
    timestamptz created_at
  }
  ai_jobs {
    uuid id
    uuid project_id
    uuid user_id
    public_job_kind kind
    public_job_status status
    jsonb input
    jsonb result
    text error
    uuid request_key
    timestamptz started_at
    timestamptz completed_at
    timestamptz provider_started_at
    timestamptz created_at
    timestamptz updated_at
  }
  ai_artifacts {
    uuid id
    uuid project_id
    uuid job_id
    text storage_path
    public_provenance provenance
    uuid original_image_id
    text prompt
    timestamptz created_at
  }
  image_embeddings {
    uuid image_id
    text description
    text model
    extensions_vector_768_ embedding
    timestamptz created_at
    timestamptz updated_at
  }
  ai_usage {
    uuid id
    uuid user_id
    uuid job_id
    text feature
    text model
    numeric_12_6_ reserved_usd
    numeric_12_6_ actual_usd
    text status
    integer image_count
    integer input_tokens
    integer output_tokens
    timestamptz created_at
  }
  ai_actions {
    uuid id
    uuid project_id
    uuid proposed_for
    text kind
    text explanation
    jsonb payload
    text status
    integer project_version
    integer booking_version
    timestamptz expires_at
    uuid applied_by
    timestamptz applied_at
    timestamptz created_at
  }
  auth_users ||--o{ profiles : "id"
  profiles ||--o{ user_roles : "user_id"
  profiles ||--o{ photographers : "user_id"
  photographers ||--o{ studios : "created_by"
  studios ||--o{ studio_members : "studio_id"
  photographers ||--o{ studio_members : "user_id"
  studios ||--o{ studio_invitations : "studio_id"
  photographers ||--o{ studio_invitations : "photographer_id"
  profiles ||--o{ studio_invitations : "invited_by"
  photographers ||--o{ services : "photographer_id"
  studios ||--o{ services : "studio_id"
  services ||--o{ service_add_ons : "service_id"
  studios ||--o{ studio_resources : "studio_id"
  photographers ||--o{ portfolios : "photographer_id"
  studios ||--o{ portfolios : "studio_id"
  portfolios ||--o{ portfolio_images : "portfolio_id"
  portfolio_images ||--o{ image_tags : "portfolio_image_id"
  tags ||--o{ image_tags : "tag_id"
  profiles ||--o{ creative_projects : "owner_id"
  profiles ||--o{ bookings : "client_id"
  creative_projects ||--o{ bookings : "project_id"
  services ||--o{ bookings : "service_id"
  photographers ||--o{ bookings : "photographer_id"
  studios ||--o{ bookings : "studio_id"
  photographers ||--o{ bookings : "assigned_photographer_id"
  bookings ||--o{ schedule_entries : "booking_id"
  photographers ||--o{ schedule_entries : "photographer_id"
  studio_resources ||--o{ schedule_entries : "resource_id"
  bookings ||--o{ booking_resources : "booking_id"
  studio_resources ||--o{ booking_resources : "resource_id"
  bookings ||--o{ brief_versions : "booking_id"
  profiles ||--o{ brief_versions : "created_by"
  bookings ||--o{ shoot_rooms : "booking_id"
  shoot_rooms ||--o{ room_messages : "room_id"
  profiles ||--o{ room_messages : "sender_id"
  shoot_rooms ||--o{ room_decisions : "room_id"
  profiles ||--o{ room_decisions : "proposed_by"
  shoot_rooms ||--o{ room_milestones : "room_id"
  profiles ||--o{ room_milestones : "created_by"
  bookings ||--o{ galleries : "booking_id"
  galleries ||--o{ gallery_images : "gallery_id"
  galleries ||--o{ gallery_selections : "gallery_id"
  gallery_images ||--o{ gallery_selections : "image_id"
  profiles ||--o{ gallery_selections : "selected_by"
  bookings ||--o{ deliveries : "booking_id"
  bookings ||--o{ reviews : "booking_id"
  profiles ||--o{ reviews : "author_id"
  photographers ||--o{ reviews : "photographer_id"
  studios ||--o{ reviews : "studio_id"
  profiles ||--o{ content_reports : "reporter_id"
  creative_projects ||--o{ ai_messages : "project_id"
  profiles ||--o{ ai_messages : "user_id"
  creative_projects ||--o{ ai_jobs : "project_id"
  profiles ||--o{ ai_jobs : "user_id"
  creative_projects ||--o{ ai_artifacts : "project_id"
  ai_jobs ||--o{ ai_artifacts : "job_id"
  gallery_images ||--o{ ai_artifacts : "original_image_id"
  portfolio_images ||--o{ image_embeddings : "image_id"
  profiles ||--o{ ai_usage : "user_id"
  ai_jobs ||--o{ ai_usage : "job_id"
  creative_projects ||--o{ ai_actions : "project_id"
  profiles ||--o{ ai_actions : "proposed_for"
  profiles ||--o{ ai_actions : "applied_by"
```

See [relationships.md](relationships.md) for exact referenced columns and table specifications for nullability.
