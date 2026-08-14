export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_health_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          latency_ms: number | null
          meta: Json
          model: string | null
          org_id: string | null
          owner_id: string | null
          surface: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          latency_ms?: number | null
          meta?: Json
          model?: string | null
          org_id?: string | null
          owner_id?: string | null
          surface?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          latency_ms?: number | null
          meta?: Json
          model?: string | null
          org_id?: string | null
          owner_id?: string | null
          surface?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_health_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reads: {
        Row: {
          created_at: string
          depth: string
          id: string
          message_id: number | null
          owner_id: string
          reader_profile_id: string | null
          reader_role: string
          surface: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          depth: string
          id?: string
          message_id?: number | null
          owner_id: string
          reader_profile_id?: string | null
          reader_role: string
          surface: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          depth?: string
          id?: string
          message_id?: number | null
          owner_id?: string
          reader_profile_id?: string | null
          reader_role?: string
          surface?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reads_reader_profile_id_fkey"
            columns: ["reader_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reads_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          claims_rendered: number | null
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          error_class: string | null
          id: string
          idempotency_key: string | null
          items_read: number | null
          org_id: string
          owner_id: string
          preset: string
          run_by_profile_id: string | null
          scope_id: string | null
          scope_type: string
          session_id: string | null
          status: string
          suppressed_claims: number | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          claims_rendered?: number | null
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          error_class?: string | null
          id?: string
          idempotency_key?: string | null
          items_read?: number | null
          org_id: string
          owner_id: string
          preset: string
          run_by_profile_id?: string | null
          scope_id?: string | null
          scope_type: string
          session_id?: string | null
          status?: string
          suppressed_claims?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          claims_rendered?: number | null
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          error_class?: string | null
          id?: string
          idempotency_key?: string | null
          items_read?: number | null
          org_id?: string
          owner_id?: string
          preset?: string
          run_by_profile_id?: string | null
          scope_id?: string | null
          scope_type?: string
          session_id?: string | null
          status?: string
          suppressed_claims?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_run_by_profile_id_fkey"
            columns: ["run_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_links: {
        Row: {
          from_turn: string
          id: string
          method: string
          to_turn: string
        }
        Insert: {
          from_turn: string
          id?: string
          method?: string
          to_turn: string
        }
        Update: {
          from_turn?: string
          id?: string
          method?: string
          to_turn?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_links_from_turn_fkey"
            columns: ["from_turn"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_links_to_turn_fkey"
            columns: ["to_turn"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context_scope: Json
          created_at: string
          id: string
          org_id: string
          profile_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          context_scope?: Json
          created_at?: string
          id?: string
          org_id: string
          profile_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          context_scope?: Json
          created_at?: string
          id?: string
          org_id?: string
          profile_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_notes: {
        Row: {
          author_id: string
          created_at: string
          did_well: string
          engagement_id: string | null
          id: string
          subject_id: string
          watch_next: string
          would_try: string
        }
        Insert: {
          author_id: string
          created_at?: string
          did_well: string
          engagement_id?: string | null
          id?: string
          subject_id: string
          watch_next: string
          would_try: string
        }
        Update: {
          author_id?: string
          created_at?: string
          did_well?: string
          engagement_id?: string | null
          id?: string
          subject_id?: string
          watch_next?: string
          would_try?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_accounts: {
        Row: {
          composio_account_id: string | null
          connected_at: string | null
          created_at: string
          id: string
          profile_id: string
          status: string
          toolkit: string
          watch_config: Json
        }
        Insert: {
          composio_account_id?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          profile_id: string
          status?: string
          toolkit: string
          watch_config?: Json
        }
        Update: {
          composio_account_id?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          status?: string
          toolkit?: string
          watch_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "connector_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_secrets: {
        Row: {
          account_id: string
          api_key: string
          created_at: string
        }
        Insert: {
          account_id: string
          api_key: string
          created_at?: string
        }
        Update: {
          account_id?: string
          api_key?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_secrets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "connector_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_ledger: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          org_id: string
          policy_version: string
          profile_id: string | null
          purpose: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          org_id: string
          policy_version?: string
          profile_id?: string | null
          purpose: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          org_id?: string
          policy_version?: string
          profile_id?: string | null
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          author: Database["public"]["Enums"]["authored_by"]
          call_text: string
          created_at: string
          date_label: string | null
          engagement_id: string | null
          id: string
          owner_id: string
          pattern_tags: string[]
          resolved_at: string | null
          situation: string
          srcs: Json
          status: Database["public"]["Enums"]["decision_status"]
          why: string
        }
        Insert: {
          author?: Database["public"]["Enums"]["authored_by"]
          call_text: string
          created_at?: string
          date_label?: string | null
          engagement_id?: string | null
          id?: string
          owner_id: string
          pattern_tags?: string[]
          resolved_at?: string | null
          situation: string
          srcs?: Json
          status?: Database["public"]["Enums"]["decision_status"]
          why: string
        }
        Update: {
          author?: Database["public"]["Enums"]["authored_by"]
          call_text?: string
          created_at?: string
          date_label?: string | null
          engagement_id?: string | null
          id?: string
          owner_id?: string
          pattern_tags?: string[]
          resolved_at?: string | null
          situation?: string
          srcs?: Json
          status?: Database["public"]["Enums"]["decision_status"]
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          content_hash: string
          content_ref: string
          created_at: string
          id: string
          parent_version_id: string | null
          slide_map: Json | null
          source_event: string
          version_no: number
          work_item_id: string
        }
        Insert: {
          content_hash: string
          content_ref: string
          created_at?: string
          id?: string
          parent_version_id?: string | null
          slide_map?: Json | null
          source_event?: string
          version_no: number
          work_item_id: string
        }
        Update: {
          content_hash?: string
          content_ref?: string
          created_at?: string
          id?: string
          parent_version_id?: string | null
          slide_map?: Json | null
          source_event?: string
          version_no?: number
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_members: {
        Row: {
          engagement_id: string
          member_role: Database["public"]["Enums"]["app_role"]
          profile_id: string
        }
        Insert: {
          engagement_id: string
          member_role: Database["public"]["Enums"]["app_role"]
          profile_id: string
        }
        Update: {
          engagement_id?: string
          member_role?: Database["public"]["Enums"]["app_role"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_members_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          brief: string | null
          brief_by: string | null
          client_label: string | null
          code: string
          created_at: string
          id: string
          org_id: string
          outcome: string | null
          term_label: string | null
          title: string
        }
        Insert: {
          brief?: string | null
          brief_by?: string | null
          client_label?: string | null
          code: string
          created_at?: string
          id?: string
          org_id: string
          outcome?: string | null
          term_label?: string | null
          title: string
        }
        Update: {
          brief?: string | null
          brief_by?: string | null
          client_label?: string | null
          code?: string
          created_at?: string
          id?: string
          org_id?: string
          outcome?: string | null
          term_label?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_items: {
        Row: {
          added_at: string
          episode_id: string
          item_role: string
          work_item_id: string
        }
        Insert: {
          added_at?: string
          episode_id: string
          item_role?: string
          work_item_id: string
        }
        Update: {
          added_at?: string
          episode_id?: string
          item_role?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_items_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "work_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_outcomes: {
        Row: {
          detail: string | null
          episode_id: string
          id: string
          kind: string
          observed_at: string
          outcome_source: string
        }
        Insert: {
          detail?: string | null
          episode_id: string
          id?: string
          kind: string
          observed_at?: string
          outcome_source: string
        }
        Update: {
          detail?: string | null
          episode_id?: string
          id?: string
          kind?: string
          observed_at?: string
          outcome_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_outcomes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "work_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_hash: string | null
          dims: Json
          event_type: string
          id: number
          payload: Json
          schema_version: string
          tenant_hash: string
          ts: string
        }
        Insert: {
          actor_hash?: string | null
          dims?: Json
          event_type: string
          id?: never
          payload?: Json
          schema_version?: string
          tenant_hash: string
          ts?: string
        }
        Update: {
          actor_hash?: string | null
          dims?: Json
          event_type?: string
          id?: never
          payload?: Json
          schema_version?: string
          tenant_hash?: string
          ts?: string
        }
        Relationships: []
      }
      events_v2: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          consent_snapshot: string | null
          engagement_id: string | null
          environment: string
          episode_id: string | null
          event_name: string
          id: string
          occurred_at: string
          props: Json
          received_at: string
          schema_version: string
          source: string
          subject_pseudo: string | null
          taxonomy_version: string | null
          tenant_pseudo: string
          work_item_id: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo: string
          work_item_id?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo?: string
          work_item_id?: string | null
        }
        Relationships: []
      }
      events_v2_2026h2: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          consent_snapshot: string | null
          engagement_id: string | null
          environment: string
          episode_id: string | null
          event_name: string
          id: string
          occurred_at: string
          props: Json
          received_at: string
          schema_version: string
          source: string
          subject_pseudo: string | null
          taxonomy_version: string | null
          tenant_pseudo: string
          work_item_id: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo: string
          work_item_id?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo?: string
          work_item_id?: string | null
        }
        Relationships: []
      }
      events_v2_2027h1: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          consent_snapshot: string | null
          engagement_id: string | null
          environment: string
          episode_id: string | null
          event_name: string
          id: string
          occurred_at: string
          props: Json
          received_at: string
          schema_version: string
          source: string
          subject_pseudo: string | null
          taxonomy_version: string | null
          tenant_pseudo: string
          work_item_id: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo: string
          work_item_id?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo?: string
          work_item_id?: string | null
        }
        Relationships: []
      }
      events_v2_2027h2: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          consent_snapshot: string | null
          engagement_id: string | null
          environment: string
          episode_id: string | null
          event_name: string
          id: string
          occurred_at: string
          props: Json
          received_at: string
          schema_version: string
          source: string
          subject_pseudo: string | null
          taxonomy_version: string | null
          tenant_pseudo: string
          work_item_id: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo: string
          work_item_id?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo?: string
          work_item_id?: string | null
        }
        Relationships: []
      }
      events_v2_default: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          consent_snapshot: string | null
          engagement_id: string | null
          environment: string
          episode_id: string | null
          event_name: string
          id: string
          occurred_at: string
          props: Json
          received_at: string
          schema_version: string
          source: string
          subject_pseudo: string | null
          taxonomy_version: string | null
          tenant_pseudo: string
          work_item_id: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo: string
          work_item_id?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          consent_snapshot?: string | null
          engagement_id?: string | null
          environment?: string
          episode_id?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          schema_version?: string
          source?: string
          subject_pseudo?: string | null
          taxonomy_version?: string | null
          tenant_pseudo?: string
          work_item_id?: string | null
        }
        Relationships: []
      }
      experiment_assignments: {
        Row: {
          assigned_at: string
          eligibility: string | null
          experiment_id: string
          profile_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          eligibility?: string | null
          experiment_id: string
          profile_id: string
          variant: string
        }
        Update: {
          assigned_at?: string
          eligibility?: string | null
          experiment_id?: string
          profile_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          ended_at: string | null
          hypothesis: string | null
          id: string
          name: string
          started_at: string | null
          variants: string[]
        }
        Insert: {
          ended_at?: string | null
          hypothesis?: string | null
          id?: string
          name: string
          started_at?: string | null
          variants?: string[]
        }
        Update: {
          ended_at?: string | null
          hypothesis?: string | null
          id?: string
          name?: string
          started_at?: string | null
          variants?: string[]
        }
        Relationships: []
      }
      feedback: {
        Row: {
          actual: string
          category: string
          created_at: string
          expected: string | null
          id: number
          org_id: string | null
          profile_id: string | null
          status: string
          url_path: string
        }
        Insert: {
          actual: string
          category: string
          created_at?: string
          expected?: string | null
          id?: never
          org_id?: string | null
          profile_id?: string | null
          status?: string
          url_path: string
        }
        Update: {
          actual?: string
          category?: string
          created_at?: string
          expected?: string | null
          id?: never
          org_id?: string | null
          profile_id?: string | null
          status?: string
          url_path?: string
        }
        Relationships: []
      }
      feedback_links: {
        Row: {
          created_at: string
          id: string
          note_id: string
          owner_confirmed: boolean
          target_work_item_id: string
          uptake: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          owner_confirmed?: boolean
          target_work_item_id: string
          uptake?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          owner_confirmed?: boolean
          target_work_item_id?: string
          uptake?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "coaching_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_links_target_work_item_id_fkey"
            columns: ["target_work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_checks: {
        Row: {
          active: boolean
          author_profile_id: string
          body: string
          created_at: string
          engagement_id: string | null
          id: string
          org_id: string
          subject_profile_id: string | null
          title: string
        }
        Insert: {
          active?: boolean
          author_profile_id: string
          body: string
          created_at?: string
          engagement_id?: string | null
          id?: string
          org_id: string
          subject_profile_id?: string | null
          title: string
        }
        Update: {
          active?: boolean
          author_profile_id?: string
          body?: string
          created_at?: string
          engagement_id?: string | null
          id?: string
          org_id?: string
          subject_profile_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_checks_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_checks_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_checks_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sessions: {
        Row: {
          created_at: string
          duplicate_count: number
          id: string
          org_id: string
          owner_id: string
          range_end: string | null
          range_start: string | null
          selected_count: number
          source_export_dated: string | null
          ts_precision_mix: Json
          vendor: string
          vendor_tier: number
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          id?: string
          org_id: string
          owner_id: string
          range_end?: string | null
          range_start?: string | null
          selected_count?: number
          source_export_dated?: string | null
          ts_precision_mix?: Json
          vendor: string
          vendor_tier: number
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          id?: string
          org_id?: string
          owner_id?: string
          range_end?: string | null
          range_start?: string | null
          selected_count?: number
          source_export_dated?: string | null
          ts_precision_mix?: Json
          vendor?: string
          vendor_tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_by: string | null
          email: string | null
          expires_at: string
          invited_role: Database["public"]["Enums"]["app_role"]
          org_id: string
          revoked_at: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          invited_role?: Database["public"]["Enums"]["app_role"]
          org_id: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          invited_role?: Database["public"]["Enums"]["app_role"]
          org_id?: string
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          profile_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          profile_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          profile_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_cites: {
        Row: {
          decision_id: string | null
          note_id: string
          task_id: string | null
        }
        Insert: {
          decision_id?: string | null
          note_id: string
          task_id?: string | null
        }
        Update: {
          decision_id?: string | null
          note_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_cites_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_cites_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "coaching_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_cites_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_one_notes: {
        Row: {
          content: string
          created_at: string
          discussed: boolean
          id: string
          kind: string
          org_id: string
          owner_id: string
          source_session_id: string | null
          talking_point: string | null
        }
        Insert: {
          content: string
          created_at?: string
          discussed?: boolean
          id?: string
          kind?: string
          org_id: string
          owner_id: string
          source_session_id?: string | null
          talking_point?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          discussed?: boolean
          id?: string
          kind?: string
          org_id?: string
          owner_id?: string
          source_session_id?: string | null
          talking_point?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_notes_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          ai_maturity: string | null
          country: string | null
          created_at: string
          data_use_tier: string | null
          id: string
          industry: string | null
          name: string
          org_mode: string | null
          settings: Json
          size_band: string | null
          vendor_display: string
        }
        Insert: {
          ai_maturity?: string | null
          country?: string | null
          created_at?: string
          data_use_tier?: string | null
          id?: string
          industry?: string | null
          name: string
          org_mode?: string | null
          settings?: Json
          size_band?: string | null
          vendor_display?: string
        }
        Update: {
          ai_maturity?: string | null
          country?: string | null
          created_at?: string
          data_use_tier?: string | null
          id?: string
          industry?: string | null
          name?: string
          org_mode?: string | null
          settings?: Json
          size_band?: string | null
          vendor_display?: string
        }
        Relationships: []
      }
      practice_signatures: {
        Row: {
          carry_through: number
          challenge: number
          computed_at: string
          direction: number
          exploration: number
          framing: number
          id: string
          org_id: string
          owner_id: string
          scope_id: string | null
          scope_type: string
          thread_count: number
          verification: number
        }
        Insert: {
          carry_through: number
          challenge: number
          computed_at?: string
          direction: number
          exploration: number
          framing: number
          id?: string
          org_id: string
          owner_id: string
          scope_id?: string | null
          scope_type: string
          thread_count: number
          verification: number
        }
        Update: {
          carry_through?: number
          challenge?: number
          computed_at?: string
          direction?: number
          exploration?: number
          framing?: number
          id?: string
          org_id?: string
          owner_id?: string
          scope_id?: string | null
          scope_type?: string
          thread_count?: number
          verification?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_signatures_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          display_name: string
          experience_band: string | null
          function_area: string | null
          id: string
          org_id: string
          primary_work_types: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          role_family: string | null
          seniority_band: string | null
          style_label: string | null
          title_band: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          display_name: string
          experience_band?: string | null
          function_area?: string | null
          id?: string
          org_id: string
          primary_work_types?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          role_family?: string | null
          seniority_band?: string | null
          style_label?: string | null
          title_band?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          display_name?: string
          experience_band?: string | null
          function_area?: string | null
          id?: string
          org_id?: string
          primary_work_types?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          role_family?: string | null
          seniority_band?: string | null
          style_label?: string | null
          title_band?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      query_log: {
        Row: {
          answer_ref: string | null
          asker_id: string
          created_at: string
          id: string
          question: string
          scope: string
          subject_id: string
        }
        Insert: {
          answer_ref?: string | null
          asker_id: string
          created_at?: string
          id?: string
          question: string
          scope: string
          subject_id: string
        }
        Update: {
          answer_ref?: string | null
          asker_id?: string
          created_at?: string
          id?: string
          question?: string
          scope?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_log_asker_id_fkey"
            columns: ["asker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_log_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_panel_ids: {
        Row: {
          consented_at: string
          panel_id: string
          policy_version: string
          profile_id: string
          withdrawn_at: string | null
        }
        Insert: {
          consented_at?: string
          panel_id?: string
          policy_version: string
          profile_id: string
          withdrawn_at?: string | null
        }
        Update: {
          consented_at?: string
          panel_id?: string
          policy_version?: string
          profile_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_panel_ids_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          detail: string | null
          engagement_id: string
          goal: string | null
          id: string
          lane_ai: string | null
          lane_edited_by_human: boolean
          lane_you: string | null
          name: string
          owner_id: string
          position: number
          status: string
          when_label: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          engagement_id: string
          goal?: string | null
          id?: string
          lane_ai?: string | null
          lane_edited_by_human?: boolean
          lane_you?: string | null
          name: string
          owner_id: string
          position?: number
          status?: string
          when_label?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          engagement_id?: string
          goal?: string | null
          id?: string
          lane_ai?: string | null
          lane_edited_by_human?: boolean
          lane_you?: string | null
          name?: string
          owner_id?: string
          position?: number
          status?: string
          when_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          content: string
          content_hash: string
          id: string
          meta: Json
          model: string | null
          role: Database["public"]["Enums"]["turn_role"]
          ts: string | null
          ts_precision: Database["public"]["Enums"]["ts_precision"]
          turn_no: number
          work_item_id: string
        }
        Insert: {
          content: string
          content_hash: string
          id?: string
          meta?: Json
          model?: string | null
          role: Database["public"]["Enums"]["turn_role"]
          ts?: string | null
          ts_precision?: Database["public"]["Enums"]["ts_precision"]
          turn_no: number
          work_item_id: string
        }
        Update: {
          content?: string
          content_hash?: string
          id?: string
          meta?: Json
          model?: string | null
          role?: Database["public"]["Enums"]["turn_role"]
          ts?: string | null
          ts_precision?: Database["public"]["Enums"]["ts_precision"]
          turn_no?: number
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turns_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_episodes: {
        Row: {
          closed_at: string | null
          id: string
          meta: Json
          objective: string | null
          opened_at: string
          org_id: string
          owner_id: string
          status: string
          task_id: string | null
          title: string
        }
        Insert: {
          closed_at?: string | null
          id?: string
          meta?: Json
          objective?: string | null
          opened_at?: string
          org_id: string
          owner_id: string
          status?: string
          task_id?: string | null
          title: string
        }
        Update: {
          closed_at?: string | null
          id?: string
          meta?: Json
          objective?: string | null
          opened_at?: string
          org_id?: string
          owner_id?: string
          status?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_episodes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_episodes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_episodes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_extracts: {
        Row: {
          content_hash: string | null
          created_at: string
          decisions: string | null
          entities: string | null
          handoff: string | null
          id: string
          model: string | null
          org_id: string
          owner_id: string
          schema_version: number
          search_tsv: unknown
          source_chars: number | null
          summary: string
          updated_at: string
          work_item_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          decisions?: string | null
          entities?: string | null
          handoff?: string | null
          id?: string
          model?: string | null
          org_id: string
          owner_id: string
          schema_version?: number
          search_tsv?: unknown
          source_chars?: number | null
          summary: string
          updated_at?: string
          work_item_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          decisions?: string | null
          entities?: string | null
          handoff?: string | null
          id?: string
          model?: string | null
          org_id?: string
          owner_id?: string
          schema_version?: number
          search_tsv?: unknown
          source_chars?: number | null
          summary?: string
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_extracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_extracts_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_links: {
        Row: {
          confirmed_at: string | null
          created_at: string
          from_item_id: string
          id: string
          org_id: string
          owner_id: string
          rationale: string | null
          relation: string
          status: string
          to_item_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          from_item_id: string
          id?: string
          org_id: string
          owner_id: string
          rationale?: string | null
          relation: string
          status?: string
          to_item_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          from_item_id?: string
          id?: string
          org_id?: string
          owner_id?: string
          rationale?: string | null
          relation?: string
          status?: string
          to_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_links_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_links_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_links_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_tasks: {
        Row: {
          mapped_at: string
          step_confirmed: boolean
          step_no: number | null
          task_id: string
          work_item_id: string
        }
        Insert: {
          mapped_at?: string
          step_confirmed?: boolean
          step_no?: number | null
          task_id: string
          work_item_id: string
        }
        Update: {
          mapped_at?: string
          step_confirmed?: boolean
          step_no?: number | null
          task_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tasks_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          captured_at: string
          content_fidelity: string
          content_hash: string | null
          content_ref: string | null
          created_at_source: string | null
          id: string
          import_session_id: string | null
          meta: Json
          org_id: string
          orig_conversation_id: string | null
          owner_id: string
          source: string
          source_meta: Json | null
          source_vendor: string | null
          title: string
          ts_precision: Database["public"]["Enums"]["ts_precision"]
          type: Database["public"]["Enums"]["work_type"]
          visibility: Database["public"]["Enums"]["work_visibility"]
          work_date: string | null
        }
        Insert: {
          captured_at?: string
          content_fidelity?: string
          content_hash?: string | null
          content_ref?: string | null
          created_at_source?: string | null
          id?: string
          import_session_id?: string | null
          meta?: Json
          org_id: string
          orig_conversation_id?: string | null
          owner_id: string
          source?: string
          source_meta?: Json | null
          source_vendor?: string | null
          title: string
          ts_precision?: Database["public"]["Enums"]["ts_precision"]
          type: Database["public"]["Enums"]["work_type"]
          visibility?: Database["public"]["Enums"]["work_visibility"]
          work_date?: string | null
        }
        Update: {
          captured_at?: string
          content_fidelity?: string
          content_hash?: string | null
          content_ref?: string | null
          created_at_source?: string | null
          id?: string
          import_session_id?: string | null
          meta?: Json
          org_id?: string
          orig_conversation_id?: string | null
          owner_id?: string
          source?: string
          source_meta?: Json | null
          source_vendor?: string | null
          title?: string
          ts_precision?: Database["public"]["Enums"]["ts_precision"]
          type?: Database["public"]["Enums"]["work_type"]
          visibility?: Database["public"]["Enums"]["work_visibility"]
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      coach_can_see_item: { Args: { item: string }; Returns: boolean }
      coaches_subject: { Args: { subject: string }; Returns: boolean }
      create_org_with_profile: {
        Args: { p_display_name: string; p_org_name: string }
        Returns: string
      }
      deactivate_member: { Args: { p_profile: string }; Returns: undefined }
      has_org_role: {
        Args: {
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_engagement_member: { Args: { eng: string }; Returns: boolean }
      is_member_of: { Args: { p_org: string }; Returns: boolean }
      is_my_profile: { Args: { p: string }; Returns: boolean }
      join_org_with_invite: {
        Args: { p_code: string; p_display_name: string }
        Returns: string
      }
      make_invite: {
        Args: {
          p_email?: string
          p_org_id?: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      my_org_id: { Args: never; Returns: string }
      my_profile_id: { Args: never; Returns: string }
      my_profile_ids: { Args: never; Returns: string[] }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      reactivate_member: { Args: { p_profile: string }; Returns: undefined }
      set_member_role: {
        Args: {
          p_profile: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "em" | "coach" | "lead" | "admin"
      authored_by: "ai_draft" | "human"
      decision_status: "draft" | "confirmed" | "discarded"
      ts_precision: "source" | "capture"
      turn_role: "user" | "assistant" | "tool"
      work_type:
        | "ai_thread"
        | "document"
        | "deck"
        | "sheet"
        | "call"
        | "email"
        | "message"
        | "image"
      work_visibility: "unmapped" | "mapped" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["em", "coach", "lead", "admin"],
      authored_by: ["ai_draft", "human"],
      decision_status: ["draft", "confirmed", "discarded"],
      ts_precision: ["source", "capture"],
      turn_role: ["user", "assistant", "tool"],
      work_type: [
        "ai_thread",
        "document",
        "deck",
        "sheet",
        "call",
        "email",
        "message",
        "image",
      ],
      work_visibility: ["unmapped", "mapped", "private"],
    },
  },
} as const
