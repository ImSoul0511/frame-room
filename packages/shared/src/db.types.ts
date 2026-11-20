
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_actions": {
                  Row: {
                    "applied_at": string | null,"applied_by": string | null,"booking_version": number | null,"created_at": string,"expires_at": string,"explanation": string,"id": string,"kind": string,"payload": NonNullable<Json>,"project_id": string,"project_version": number,"proposed_for": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"applied_by"?: string | null,"booking_version"?: number | null,"created_at"?: string,"expires_at"?: string,"explanation": string,"id"?: string,"kind": string,"payload": NonNullable<Json>,"project_id": string,"project_version": number,"proposed_for": string,"status"?: string
                  }
                  Update: {
                    "applied_at"?: string | null,"applied_by"?: string | null,"booking_version"?: number | null,"created_at"?: string,"expires_at"?: string,"explanation"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"project_id"?: string,"project_version"?: number,"proposed_for"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_actions_applied_by_fkey"
      columns: ["applied_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_actions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "creative_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_actions_proposed_for_fkey"
      columns: ["proposed_for"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_artifacts": {
                  Row: {
                    "created_at": string,"id": string,"job_id": string,"original_image_id": string | null,"project_id": string,"prompt": string,"provenance": Database["public"]['Enums']["provenance"],"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_id": string,"original_image_id"?: string | null,"project_id": string,"prompt": string,"provenance": Database["public"]['Enums']["provenance"],"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_id"?: string,"original_image_id"?: string | null,"project_id"?: string,"prompt"?: string,"provenance"?: Database["public"]['Enums']["provenance"],"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_artifacts_job_id_fkey"
      columns: ["job_id"]
isOneToOne: true
      referencedRelation: "ai_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_artifacts_original_image_id_fkey"
      columns: ["original_image_id"]
isOneToOne: false
      referencedRelation: "gallery_images"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_artifacts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "creative_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_jobs": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"error": string | null,"id": string,"input": NonNullable<Json>,"kind": Database["public"]['Enums']["job_kind"],"project_id": string | null,"provider_started_at": string | null,"request_key": string,"result": Json | null,"started_at": string | null,"status": Database["public"]['Enums']["job_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"input": NonNullable<Json>,"kind": Database["public"]['Enums']["job_kind"],"project_id"?: string | null,"provider_started_at"?: string | null,"request_key": string,"result"?: Json | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"kind"?: Database["public"]['Enums']["job_kind"],"project_id"?: string | null,"provider_started_at"?: string | null,"request_key"?: string,"result"?: Json | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_jobs_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "creative_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_jobs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"project_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"project_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"project_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "creative_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage": {
                  Row: {
                    "actual_usd": number | null,"created_at": string,"feature": string,"id": string,"image_count": number,"input_tokens": number | null,"job_id": string | null,"model": string,"output_tokens": number | null,"reserved_usd": number,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_usd"?: number | null,"created_at"?: string,"feature": string,"id"?: string,"image_count"?: number,"input_tokens"?: number | null,"job_id"?: string | null,"model": string,"output_tokens"?: number | null,"reserved_usd": number,"status"?: string,"user_id": string
                  }
                  Update: {
                    "actual_usd"?: number | null,"created_at"?: string,"feature"?: string,"id"?: string,"image_count"?: number,"input_tokens"?: number | null,"job_id"?: string | null,"model"?: string,"output_tokens"?: number | null,"reserved_usd"?: number,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "ai_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_cancellations": {
                  Row: {
                    "booking_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"is_client_proposal": boolean,"proposed_by": string,"reason": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"is_client_proposal": boolean,"proposed_by": string,"reason": string,"status"?: string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"is_client_proposal"?: boolean,"proposed_by"?: string,"reason"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_cancellations_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_cancellations_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_cancellations_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_resources": {
                  Row: {
                    "booking_id": string,"name": string,"resource_id": string,"type": Database["public"]['Enums']["resource_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"name": string,"resource_id": string,"type": Database["public"]['Enums']["resource_type"]
                  }
                  Update: {
                    "booking_id"?: string,"name"?: string,"resource_id"?: string,"type"?: Database["public"]['Enums']["resource_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_resources_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_resources_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "studio_resources"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "agreed_brief_version": number | null,"assigned_photographer_id": string | null,"client_id": string,"completion_due_at": string | null,"completion_hold_at": string | null,"completion_remaining_ms": number | null,"conversation_id": string | null,"created_at": string,"id": string,"note": string,"owner_type": Database["public"]['Enums']["provider_type"],"photographer_id": string | null,"project_id": string,"request_key": string | null,"scheduled_end": string,"scheduled_start": string,"service_id": string,"service_name": string,"service_snapshot": NonNullable<Json>,"status": Database["public"]['Enums']["booking_status"],"studio_id": string | null,"total_price": number,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_brief_version"?: number | null,"assigned_photographer_id"?: string | null,"client_id": string,"completion_due_at"?: string | null,"completion_hold_at"?: string | null,"completion_remaining_ms"?: number | null,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"note"?: string,"owner_type": Database["public"]['Enums']["provider_type"],"photographer_id"?: string | null,"project_id": string,"request_key"?: string | null,"scheduled_end": string,"scheduled_start": string,"service_id": string,"service_name": string,"service_snapshot": NonNullable<Json>,"status"?: Database["public"]['Enums']["booking_status"],"studio_id"?: string | null,"total_price": number,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "agreed_brief_version"?: number | null,"assigned_photographer_id"?: string | null,"client_id"?: string,"completion_due_at"?: string | null,"completion_hold_at"?: string | null,"completion_remaining_ms"?: number | null,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"note"?: string,"owner_type"?: Database["public"]['Enums']["provider_type"],"photographer_id"?: string | null,"project_id"?: string,"request_key"?: string | null,"scheduled_end"?: string,"scheduled_start"?: string,"service_id"?: string,"service_name"?: string,"service_snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["booking_status"],"studio_id"?: string | null,"total_price"?: number,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_assigned_photographer_id_fkey"
      columns: ["assigned_photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "creative_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"brief_versions": {
                  Row: {
                    "booking_id": string,"client_approved": boolean,"content": NonNullable<Json>,"created_at": string,"created_by": string,"id": string,"provider_approved": boolean,"status": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"client_approved"?: boolean,"content": NonNullable<Json>,"created_at"?: string,"created_by": string,"id"?: string,"provider_approved"?: boolean,"status"?: string,"version": number
                  }
                  Update: {
                    "booking_id"?: string,"client_approved"?: boolean,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"id"?: string,"provider_approved"?: boolean,"status"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "brief_versions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brief_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"content_reports": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"outcome": string | null,"reason": string,"reporter_id": string,"status": string,"target_id": string,"target_type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"outcome"?: string | null,"reason": string,"reporter_id": string,"status"?: string,"target_id": string,"target_type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"outcome"?: string | null,"reason"?: string,"reporter_id"?: string,"status"?: string,"target_id"?: string,"target_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "client_id": string,"created_at": string,"id": string,"photographer_id": string | null,"studio_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"id"?: string,"photographer_id"?: string | null,"studio_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"id"?: string,"photographer_id"?: string | null,"studio_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"creative_projects": {
                  Row: {
                    "brief": Json | null,"created_at": string,"id": string,"idea": string,"owner_id": string,"reference_paths": (string)[],"selected_artifact_ids": (string)[],"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brief"?: Json | null,"created_at"?: string,"id"?: string,"idea": string,"owner_id": string,"reference_paths"?: (string)[],"selected_artifact_ids"?: (string)[],"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "brief"?: Json | null,"created_at"?: string,"id"?: string,"idea"?: string,"owner_id"?: string,"reference_paths"?: (string)[],"selected_artifact_ids"?: (string)[],"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_projects_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"deliveries": {
                  Row: {
                    "booking_id": string,"created_at": string,"file_name": string,"id": string,"mime_type": string,"selection_round": number | null,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"file_name": string,"id"?: string,"mime_type": string,"selection_round"?: number | null,"storage_path": string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string,"selection_round"?: number | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deliveries_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"galleries": {
                  Row: {
                    "booking_id": string,"created_at": string,"id": string,"revision_requested_at": string | null,"round": number,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"id"?: string,"revision_requested_at"?: string | null,"round"?: number,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"id"?: string,"revision_requested_at"?: string | null,"round"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "galleries_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"gallery_images": {
                  Row: {
                    "caption": string,"created_at": string,"gallery_id": string,"height": number,"id": string,"provenance": Database["public"]['Enums']["provenance"],"storage_path": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string,"created_at"?: string,"gallery_id": string,"height": number,"id"?: string,"provenance"?: Database["public"]['Enums']["provenance"],"storage_path": string,"width": number
                  }
                  Update: {
                    "caption"?: string,"created_at"?: string,"gallery_id"?: string,"height"?: number,"id"?: string,"provenance"?: Database["public"]['Enums']["provenance"],"storage_path"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gallery_images_gallery_id_fkey"
      columns: ["gallery_id"]
isOneToOne: false
      referencedRelation: "galleries"
      referencedColumns: ["id"]
    }
                  ]
                },"gallery_selections": {
                  Row: {
                    "created_at": string,"gallery_id": string,"image_id": string,"round": number,"selected_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gallery_id": string,"image_id": string,"round": number,"selected_by": string
                  }
                  Update: {
                    "created_at"?: string,"gallery_id"?: string,"image_id"?: string,"round"?: number,"selected_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gallery_selections_gallery_id_fkey"
      columns: ["gallery_id"]
isOneToOne: false
      referencedRelation: "galleries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gallery_selections_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "gallery_images"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gallery_selections_selected_by_fkey"
      columns: ["selected_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"image_embeddings": {
                  Row: {
                    "created_at": string,"description": string,"embedding": string,"image_id": string,"model": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"embedding": string,"image_id": string,"model": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"embedding"?: string,"image_id"?: string,"model"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "image_embeddings_image_id_fkey"
      columns: ["image_id"]
isOneToOne: true
      referencedRelation: "portfolio_images"
      referencedColumns: ["id"]
    }
                  ]
                },"image_tags": {
                  Row: {
                    "confidence": number | null,"portfolio_image_id": string,"source": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence"?: number | null,"portfolio_image_id": string,"source": string,"tag_id": string
                  }
                  Update: {
                    "confidence"?: number | null,"portfolio_image_id"?: string,"source"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "image_tags_portfolio_image_id_fkey"
      columns: ["portfolio_image_id"]
isOneToOne: false
      referencedRelation: "portfolio_images"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "booking_id": string | null,"created_at": string,"event": string,"id": string,"read_at": string | null,"recipient_id": string,"studio_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"created_at"?: string,"event": string,"id"?: string,"read_at"?: string | null,"recipient_id": string,"studio_id"?: string | null
                  }
                  Update: {
                    "booking_id"?: string | null,"created_at"?: string,"event"?: string,"id"?: string,"read_at"?: string | null,"recipient_id"?: string,"studio_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"photo_feedback": {
                  Row: {
                    "author_id": string,"created_at": string,"id": string,"image_id": string,"note": string,"round": number,"x": number | null,"y": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"id"?: string,"image_id": string,"note": string,"round": number,"x"?: number | null,"y"?: number | null
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"id"?: string,"image_id"?: string,"note"?: string,"round"?: number,"x"?: number | null,"y"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photo_feedback_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photo_feedback_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "gallery_images"
      referencedColumns: ["id"]
    }
                  ]
                },"photographers": {
                  Row: {
                    "bio": string,"city": string,"contact_email": string | null,"created_at": string,"display_name": string,"district": string,"genres": (Database["public"]['Enums']["genre"])[],"id": string,"is_hidden": boolean,"professional_roles": (string)[],"styles": (string)[],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string,"city"?: string,"contact_email"?: string | null,"created_at"?: string,"display_name": string,"district"?: string,"genres": (Database["public"]['Enums']["genre"])[],"id"?: string,"is_hidden"?: boolean,"professional_roles"?: (string)[],"styles"?: (string)[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "bio"?: string,"city"?: string,"contact_email"?: string | null,"created_at"?: string,"display_name"?: string,"district"?: string,"genres"?: (Database["public"]['Enums']["genre"])[],"id"?: string,"is_hidden"?: boolean,"professional_roles"?: (string)[],"styles"?: (string)[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "photographers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolio_images": {
                  Row: {
                    "caption": string,"collected_at": string | null,"created_at": string,"crew_credits": string,"height": number,"id": string,"is_hidden": boolean,"license_note": string | null,"portfolio_id": string,"provenance": Database["public"]['Enums']["provenance"],"sort_order": number,"source": string | null,"storage_path": string,"updated_at": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string,"collected_at"?: string | null,"created_at"?: string,"crew_credits"?: string,"height": number,"id"?: string,"is_hidden"?: boolean,"license_note"?: string | null,"portfolio_id": string,"provenance"?: Database["public"]['Enums']["provenance"],"sort_order"?: number,"source"?: string | null,"storage_path": string,"updated_at"?: string,"width": number
                  }
                  Update: {
                    "caption"?: string,"collected_at"?: string | null,"created_at"?: string,"crew_credits"?: string,"height"?: number,"id"?: string,"is_hidden"?: boolean,"license_note"?: string | null,"portfolio_id"?: string,"provenance"?: Database["public"]['Enums']["provenance"],"sort_order"?: number,"source"?: string | null,"storage_path"?: string,"updated_at"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_images_portfolio_id_fkey"
      columns: ["portfolio_id"]
isOneToOne: false
      referencedRelation: "portfolios"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolios": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string,"genre": Database["public"]['Enums']["genre"],"id": string,"owner_type": Database["public"]['Enums']["provider_type"],"photographer_id": string | null,"published_at": string | null,"status": Database["public"]['Enums']["portfolio_status"],"studio_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"genre": Database["public"]['Enums']["genre"],"id"?: string,"owner_type": Database["public"]['Enums']["provider_type"],"photographer_id"?: string | null,"published_at"?: string | null,"status"?: Database["public"]['Enums']["portfolio_status"],"studio_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"genre"?: Database["public"]['Enums']["genre"],"id"?: string,"owner_type"?: Database["public"]['Enums']["provider_type"],"photographer_id"?: string | null,"published_at"?: string | null,"status"?: Database["public"]['Enums']["portfolio_status"],"studio_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolios_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolios_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string,"user_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string,"user_name": string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string,"user_name"?: string
                  }
                  Relationships: [

                  ]
                },"reviews": {
                  Row: {
                    "author_id": string,"booking_id": string,"comment": string,"created_at": string,"deleted_at": string | null,"id": string,"is_hidden": boolean,"moderation_reason": string | null,"photographer_id": string | null,"rating": number,"reassessment_requested_at": string | null,"studio_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"booking_id": string,"comment"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_hidden"?: boolean,"moderation_reason"?: string | null,"photographer_id"?: string | null,"rating": number,"reassessment_requested_at"?: string | null,"studio_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"booking_id"?: string,"comment"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_hidden"?: boolean,"moderation_reason"?: string | null,"photographer_id"?: string | null,"rating"?: number,"reassessment_requested_at"?: string | null,"studio_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"room_decisions": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"proposed_by": string,"room_id": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"proposed_by": string,"room_id": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"proposed_by"?: string,"room_id"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_decisions_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_decisions_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "shoot_rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"room_messages": {
                  Row: {
                    "conversation_id": string | null,"created_at": string,"id": string,"is_hidden": boolean,"room_id": string | null,"sender_id": string | null,"storage_path": string | null,"submission_id": string | null,"text": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id"?: string | null,"created_at"?: string,"id"?: string,"is_hidden"?: boolean,"room_id"?: string | null,"sender_id"?: string | null,"storage_path"?: string | null,"submission_id"?: string | null,"text": string,"type"?: string
                  }
                  Update: {
                    "conversation_id"?: string | null,"created_at"?: string,"id"?: string,"is_hidden"?: boolean,"room_id"?: string | null,"sender_id"?: string | null,"storage_path"?: string | null,"submission_id"?: string | null,"text"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_messages_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "shoot_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"room_milestones": {
                  Row: {
                    "created_at": string,"created_by": string,"due_at": string | null,"id": string,"room_id": string,"status": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"due_at"?: string | null,"id"?: string,"room_id": string,"status"?: string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"due_at"?: string | null,"id"?: string,"room_id"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_milestones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_milestones_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "shoot_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_milestones_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_providers": {
                  Row: {
                    "created_at": string,"id": string,"photographer_id": string | null,"studio_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"photographer_id"?: string | null,"studio_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"photographer_id"?: string | null,"studio_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_providers_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_providers_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_providers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"schedule_entries": {
                  Row: {
                    "booking_id": string | null,"created_at": string,"during": unknown,"id": string,"label": string,"photographer_id": string | null,"resource_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"created_at"?: string,"during": unknown,"id"?: string,"label"?: string,"photographer_id"?: string | null,"resource_id"?: string | null
                  }
                  Update: {
                    "booking_id"?: string | null,"created_at"?: string,"during"?: unknown,"id"?: string,"label"?: string,"photographer_id"?: string | null,"resource_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_entries_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedule_entries_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedule_entries_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "studio_resources"
      referencedColumns: ["id"]
    }
                  ]
                },"service_add_ons": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string,"id": string,"is_active": boolean,"name": string,"price": number,"service_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"is_active"?: boolean,"name": string,"price": number,"service_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"price"?: number,"service_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_add_ons_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string,"duration_minutes": number,"genre": Database["public"]['Enums']["genre"],"id": string,"is_active": boolean,"name": string,"owner_type": Database["public"]['Enums']["provider_type"],"photo_count": number,"photographer_id": string | null,"price": number,"retouched_count": number,"revision_limit": number | null,"selection_quota": number | null,"studio_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"duration_minutes": number,"genre": Database["public"]['Enums']["genre"],"id"?: string,"is_active"?: boolean,"name": string,"owner_type": Database["public"]['Enums']["provider_type"],"photo_count"?: number,"photographer_id"?: string | null,"price": number,"retouched_count"?: number,"revision_limit"?: number | null,"selection_quota"?: number | null,"studio_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"duration_minutes"?: number,"genre"?: Database["public"]['Enums']["genre"],"id"?: string,"is_active"?: boolean,"name"?: string,"owner_type"?: Database["public"]['Enums']["provider_type"],"photo_count"?: number,"photographer_id"?: string | null,"price"?: number,"retouched_count"?: number,"revision_limit"?: number | null,"selection_quota"?: number | null,"studio_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"shoot_rooms": {
                  Row: {
                    "booking_id": string,"created_at": string,"id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"id"?: string,"status"?: string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shoot_rooms_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"studio_invitations": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string,"photographer_id": string,"responded_at": string | null,"role": Database["public"]['Enums']["studio_member_role"],"status": Database["public"]['Enums']["invitation_status"],"studio_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by": string,"photographer_id": string,"responded_at"?: string | null,"role"?: Database["public"]['Enums']["studio_member_role"],"status"?: Database["public"]['Enums']["invitation_status"],"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string,"photographer_id"?: string,"responded_at"?: string | null,"role"?: Database["public"]['Enums']["studio_member_role"],"status"?: Database["public"]['Enums']["invitation_status"],"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "studio_invitations_photographer_id_fkey"
      columns: ["photographer_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "studio_invitations_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studio_members": {
                  Row: {
                    "joined_at": string,"role": Database["public"]['Enums']["studio_member_role"],"studio_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"role": Database["public"]['Enums']["studio_member_role"],"studio_id": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["studio_member_role"],"studio_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_members_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "studio_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["user_id"]
    }
                  ]
                },"studio_resources": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string,"id": string,"is_active": boolean,"name": string,"studio_id": string,"type": Database["public"]['Enums']["resource_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"is_active"?: boolean,"name": string,"studio_id": string,"type": Database["public"]['Enums']["resource_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"studio_id"?: string,"type"?: Database["public"]['Enums']["resource_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_resources_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studios": {
                  Row: {
                    "address": string,"city": string,"contact_email": string | null,"created_at": string,"created_by": string,"deleted_at": string | null,"description": string,"district": string,"genres": (Database["public"]['Enums']["genre"])[],"id": string,"is_hidden": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"city"?: string,"contact_email"?: string | null,"created_at"?: string,"created_by": string,"deleted_at"?: string | null,"description"?: string,"district"?: string,"genres": (Database["public"]['Enums']["genre"])[],"id"?: string,"is_hidden"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"city"?: string,"contact_email"?: string | null,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"description"?: string,"district"?: string,"genres"?: (Database["public"]['Enums']["genre"])[],"id"?: string,"is_hidden"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studios_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "photographers"
      referencedColumns: ["user_id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "id": string,"kind": Database["public"]['Enums']["tag_kind"],"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind": Database["public"]['Enums']["tag_kind"],"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"kind"?: Database["public"]['Enums']["tag_kind"],"name"?: string,"slug"?: string
                  }
                  Relationships: [

                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "providers": {
                  Row: {
                    "bio": string | null,"city": string | null,"display_name": string | null,"district": string | null,"genres": (string)[] | null,"id": string | null,"price_from": number | null,"rating_avg": number | null,"review_count": number | null,"styles": (string)[] | null,"type": string | null
                  }
                  ComputedFields: never
                  Relationships: [

                  ]
                }
          }
          Functions: {
            "frameroom_archive_job":
{ Args: { "message_id": number }; Returns: undefined
                           },
"frameroom_claim_jobs":
{ Args: Record<PropertyKey, never>; Returns: {
              "message": Json,"msg_id": number
            }[]
                           },
"frameroom_complete_due_bookings":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"frameroom_enqueue_job":
{ Args: { "job_id": string }; Returns: undefined
                           },
"frameroom_reschedule":
{ Args: { "assignee"?: string,"bid": string,"ends": string,"expected_version": number,"resources"?: (string)[],"starts": string }; Returns: {
              "agreed_brief_version": number | null,
"assigned_photographer_id": string | null,
"client_id": string,
"completion_due_at": string | null,
"completion_hold_at": string | null,
"completion_remaining_ms": number | null,
"conversation_id": string | null,
"created_at": string,
"id": string,
"note": string,
"owner_type": Database["public"]['Enums']["provider_type"],
"photographer_id": string | null,
"project_id": string,
"request_key": string | null,
"scheduled_end": string,
"scheduled_start": string,
"service_id": string,
"service_name": string,
"service_snapshot": NonNullable<Json>,
"status": Database["public"]['Enums']["booking_status"],
"studio_id": string | null,
"total_price": number,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"frameroom_reserve_usage":
{ Args: { "feature_name": string,"images": number,"model_name": string,"monthly_limit"?: number,"reserve_amount": number,"uid": string }; Returns: string
                           },
"frameroom_set_completion_hold":
{ Args: { "p_booking_id": string,"p_hold": boolean,"p_reason": string,"p_version": number }; Returns: {
              "agreed_brief_version": number | null,
"assigned_photographer_id": string | null,
"client_id": string,
"completion_due_at": string | null,
"completion_hold_at": string | null,
"completion_remaining_ms": number | null,
"conversation_id": string | null,
"created_at": string,
"id": string,
"note": string,
"owner_type": Database["public"]['Enums']["provider_type"],
"photographer_id": string | null,
"project_id": string,
"request_key": string | null,
"scheduled_end": string,
"scheduled_start": string,
"service_id": string,
"service_name": string,
"service_snapshot": NonNullable<Json>,
"status": Database["public"]['Enums']["booking_status"],
"studio_id": string | null,
"total_price": number,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"frameroom_transition":
{ Args: { "assignee"?: string,"bid": string,"desired": Database["public"]['Enums']["booking_status"],"ends"?: string,"expected_version": number,"reason"?: string,"resources"?: (string)[],"starts"?: string }; Returns: {
              "agreed_brief_version": number | null,
"assigned_photographer_id": string | null,
"client_id": string,
"completion_due_at": string | null,
"completion_hold_at": string | null,
"completion_remaining_ms": number | null,
"conversation_id": string | null,
"created_at": string,
"id": string,
"note": string,
"owner_type": Database["public"]['Enums']["provider_type"],
"photographer_id": string | null,
"project_id": string,
"request_key": string | null,
"scheduled_end": string,
"scheduled_start": string,
"service_id": string,
"service_name": string,
"service_snapshot": NonNullable<Json>,
"status": Database["public"]['Enums']["booking_status"],
"studio_id": string | null,
"total_price": number,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"uuid_generate_v7":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "booking_status": "pending"|"confirmed"|"rejected"|"cancelled"|"in_progress"|"proofing"|"delivered"|"completed","genre": "portrait"|"fashion"|"wedding"|"family"|"product"|"food"|"event"|"cosplay","invitation_status": "pending"|"accepted"|"declined"|"revoked","job_kind": "concept"|"edit"|"cull"|"index","job_status": "queued"|"running"|"succeeded"|"failed"|"uncertain","portfolio_status": "draft"|"published"|"hidden","provenance": "captured"|"manipulated"|"ai_generated","provider_type": "photographer"|"studio","resource_type": "room"|"equipment","studio_member_role": "manager"|"photographer","tag_kind": "tone"|"setting"|"mood"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "booking_status": ["pending", "confirmed", "rejected", "cancelled", "in_progress", "proofing", "delivered", "completed"],"genre": ["portrait", "fashion", "wedding", "family", "product", "food", "event", "cosplay"],"invitation_status": ["pending", "accepted", "declined", "revoked"],"job_kind": ["concept", "edit", "cull", "index"],"job_status": ["queued", "running", "succeeded", "failed", "uncertain"],"portfolio_status": ["draft", "published", "hidden"],"provenance": ["captured", "manipulated", "ai_generated"],"provider_type": ["photographer", "studio"],"resource_type": ["room", "equipment"],"studio_member_role": ["manager", "photographer"],"tag_kind": ["tone", "setting", "mood"]
          }
        }
} as const
