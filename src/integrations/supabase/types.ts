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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_costs_daily: {
        Row: {
          amount_usd: number
          currency: string
          day: string
          fetched_at: string
          input_tokens: number | null
          openai_project_id: string
          output_tokens: number | null
          project_label: string | null
        }
        Insert: {
          amount_usd?: number
          currency?: string
          day: string
          fetched_at?: string
          input_tokens?: number | null
          openai_project_id: string
          output_tokens?: number | null
          project_label?: string | null
        }
        Update: {
          amount_usd?: number
          currency?: string
          day?: string
          fetched_at?: string
          input_tokens?: number | null
          openai_project_id?: string
          output_tokens?: number | null
          project_label?: string | null
        }
        Relationships: []
      }
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
          context_manifest: Json | null
          cost_usd: number | null
          created_at: string
          error_class: string | null
          handoffs: Json | null
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
          context_manifest?: Json | null
          cost_usd?: number | null
          created_at?: string
          error_class?: string | null
          handoffs?: Json | null
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
          context_manifest?: Json | null
          cost_usd?: number | null
          created_at?: string
          error_class?: string | null
          handoffs?: Json | null
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
      answer_cites: {
        Row: {
          created_at: string
          depth: string
          id: string
          node_id: string
          ord: number
          turn_id: string | null
          work_item_id: string
        }
        Insert: {
          created_at?: string
          depth: string
          id?: string
          node_id: string
          ord?: number
          turn_id?: string | null
          work_item_id: string
        }
        Update: {
          created_at?: string
          depth?: string
          id?: string
          node_id?: string
          ord?: number
          turn_id?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_cites_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workboard_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_cites_turn_belongs"
            columns: ["turn_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id", "work_item_id"]
          },
          {
            foreignKeyName: "answer_cites_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      board_documents: {
        Row: {
          author_profile_id: string
          content: Json
          created_at: string
          id: string
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          content?: Json
          created_at?: string
          id?: string
          task_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          content?: Json
          created_at?: string
          id?: string
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_documents_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_documents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      board_share_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_opened_at: string | null
          opened_count: number
          org_id: string
          revoked_at: string | null
          token_hash: string
          workboard_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_opened_at?: string | null
          opened_count?: number
          org_id: string
          revoked_at?: string | null
          token_hash: string
          workboard_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_opened_at?: string | null
          opened_count?: number
          org_id?: string
          revoked_at?: string | null
          token_hash?: string
          workboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_share_links_workboard_id_fkey"
            columns: ["workboard_id"]
            isOneToOne: false
            referencedRelation: "workboards"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_nodes: {
        Row: {
          engagement_id: string
          id: string
          org_id: string
          owner_id: string
          updated_at: string
          work_item_id: string
          x: number
          y: number
        }
        Insert: {
          engagement_id: string
          id?: string
          org_id: string
          owner_id: string
          updated_at?: string
          work_item_id: string
          x: number
          y: number
        }
        Update: {
          engagement_id?: string
          id?: string
          org_id?: string
          owner_id?: string
          updated_at?: string
          work_item_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_nodes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
          context_manifest: Json | null
          created_at: string
          id: number
          role: string
          session_id: string
        }
        Insert: {
          content: string
          context_manifest?: Json | null
          created_at?: string
          id?: never
          role: string
          session_id: string
        }
        Update: {
          content?: string
          context_manifest?: Json | null
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
      clients: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          quick_folder: boolean
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          quick_folder?: boolean
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          quick_folder?: boolean
        }
        Relationships: []
      }
      coaching_item_exclusions: {
        Row: {
          excluded_at: string
          link_id: string
          work_item_id: string
        }
        Insert: {
          excluded_at?: string
          link_id: string
          work_item_id: string
        }
        Update: {
          excluded_at?: string
          link_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_item_exclusions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coaching_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_item_exclusions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_link_audit: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          detail: Json
          id: string
          link_id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          link_id: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_link_audit_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_link_audit_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coaching_links"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_link_engagements: {
        Row: {
          engagement_id: string
          link_id: string
        }
        Insert: {
          engagement_id: string
          link_id: string
        }
        Update: {
          engagement_id?: string
          link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_link_engagements_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_link_engagements_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coaching_links"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_links: {
        Row: {
          access_level: string
          agreement_ref: string | null
          basis: string
          coach_profile_id: string | null
          consent_withdrawn_at: string | null
          consented_at: string | null
          created_at: string
          created_by: string
          disclosed_at: string | null
          ended_at: string | null
          id: string
          invite_code: string | null
          org_id: string
          relation: string
          scope: string
          subject_profile_id: string
        }
        Insert: {
          access_level?: string
          agreement_ref?: string | null
          basis?: string
          coach_profile_id?: string | null
          consent_withdrawn_at?: string | null
          consented_at?: string | null
          created_at?: string
          created_by: string
          disclosed_at?: string | null
          ended_at?: string | null
          id?: string
          invite_code?: string | null
          org_id: string
          relation: string
          scope?: string
          subject_profile_id: string
        }
        Update: {
          access_level?: string
          agreement_ref?: string | null
          basis?: string
          coach_profile_id?: string | null
          consent_withdrawn_at?: string | null
          consented_at?: string | null
          created_at?: string
          created_by?: string
          disclosed_at?: string | null
          ended_at?: string | null
          id?: string
          invite_code?: string | null
          org_id?: string
          relation?: string
          scope?: string
          subject_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_links_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_links_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_note_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          note_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          note_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_note_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_note_replies_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "coaching_notes"
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
          read_at: string | null
          subject_id: string
          task_id: string | null
          watch_next: string
          work_item_id: string | null
          would_try: string
        }
        Insert: {
          author_id: string
          created_at?: string
          did_well: string
          engagement_id?: string | null
          id?: string
          read_at?: string | null
          subject_id: string
          task_id?: string | null
          watch_next: string
          work_item_id?: string | null
          would_try: string
        }
        Update: {
          author_id?: string
          created_at?: string
          did_well?: string
          engagement_id?: string | null
          id?: string
          read_at?: string | null
          subject_id?: string
          task_id?: string | null
          watch_next?: string
          work_item_id?: string | null
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
          {
            foreignKeyName: "coaching_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
      data_consent_ledger: {
        Row: {
          actor_profile_id: string | null
          consent_text_version: string
          created_at: string
          new_tier: string
          new_tier_d_switch: boolean | null
          notice_hash: string
          old_tier: string | null
          old_tier_d_switch: boolean | null
          org_ceiling_in_effect: string
          org_id: string
          profile_id: string | null
          scope: string
          surface: string
          version: number
        }
        Insert: {
          actor_profile_id?: string | null
          consent_text_version: string
          created_at?: string
          new_tier: string
          new_tier_d_switch?: boolean | null
          notice_hash: string
          old_tier?: string | null
          old_tier_d_switch?: boolean | null
          org_ceiling_in_effect: string
          org_id: string
          profile_id?: string | null
          scope: string
          surface: string
          version?: number
        }
        Update: {
          actor_profile_id?: string | null
          consent_text_version?: string
          created_at?: string
          new_tier?: string
          new_tier_d_switch?: boolean | null
          notice_hash?: string
          old_tier?: string | null
          old_tier_d_switch?: boolean | null
          org_ceiling_in_effect?: string
          org_id?: string
          profile_id?: string | null
          scope?: string
          surface?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_consent_ledger_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_consent_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_consent_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_consent_state: {
        Row: {
          id: string
          ledger_version: number
          org_id: string
          profile_id: string | null
          scope: string
          tier: string
          tier_d_switch: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          ledger_version: number
          org_id: string
          profile_id?: string | null
          scope: string
          tier: string
          tier_d_switch?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          ledger_version?: number
          org_id?: string
          profile_id?: string | null
          scope?: string
          tier?: string
          tier_d_switch?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_consent_state_ledger_version_fkey"
            columns: ["ledger_version"]
            isOneToOne: false
            referencedRelation: "data_consent_ledger"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "data_consent_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_consent_state_profile_id_fkey"
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
      demo_presets: {
        Row: {
          answer: string | null
          context_manifest: Json | null
          engagement_id: string
          generated_at: string | null
          generated_from_commit: string | null
          id: string
          position: number
          question: string
          turn_refs: Json
        }
        Insert: {
          answer?: string | null
          context_manifest?: Json | null
          engagement_id: string
          generated_at?: string | null
          generated_from_commit?: string | null
          id?: string
          position: number
          question: string
          turn_refs?: Json
        }
        Update: {
          answer?: string | null
          context_manifest?: Json | null
          engagement_id?: string
          generated_at?: string | null
          generated_from_commit?: string | null
          id?: string
          position?: number
          question?: string
          turn_refs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "demo_presets_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          content_hash: string
          content_ref: string
          created_at: string
          created_at_turn: number | null
          id: string
          origin: string | null
          parent_version_id: string | null
          prompted_by_turn: number | null
          slide_map: Json | null
          source_event: string
          version_no: number
          work_item_id: string
        }
        Insert: {
          content_hash: string
          content_ref: string
          created_at?: string
          created_at_turn?: number | null
          id?: string
          origin?: string | null
          parent_version_id?: string | null
          prompted_by_turn?: number | null
          slide_map?: Json | null
          source_event?: string
          version_no: number
          work_item_id: string
        }
        Update: {
          content_hash?: string
          content_ref?: string
          created_at?: string
          created_at_turn?: number | null
          id?: string
          origin?: string | null
          parent_version_id?: string | null
          prompted_by_turn?: number | null
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
      engagement_brief_files: {
        Row: {
          created_at: string
          created_by: string | null
          engagement_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engagement_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_brief_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_brief_files_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_brief_files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          engagement_id: string
          member_role: Database["public"]["Enums"]["app_role"]
          profile_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          engagement_id: string
          member_role: Database["public"]["Enums"]["app_role"]
          profile_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          engagement_id?: string
          member_role?: Database["public"]["Enums"]["app_role"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      engagement_views: {
        Row: {
          engagement_id: string
          last_viewed_at: string
          profile_id: string
        }
        Insert: {
          engagement_id: string
          last_viewed_at?: string
          profile_id: string
        }
        Update: {
          engagement_id?: string
          last_viewed_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_views_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_views_profile_id_fkey"
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
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          ends_at: string | null
          external_ref: string | null
          guest_seats_counted: boolean
          id: string
          notes: string | null
          org_id: string
          plan: string
          seats: number | null
          source: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          external_ref?: string | null
          guest_seats_counted?: boolean
          id?: string
          notes?: string | null
          org_id: string
          plan?: string
          seats?: number | null
          source: string
          starts_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          external_ref?: string | null
          guest_seats_counted?: boolean
          id?: string
          notes?: string | null
          org_id?: string
          plan?: string
          seats?: number | null
          source?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_org_id_fkey"
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
          affiliated: boolean | null
          classifier_version: string | null
          client_seq: number | null
          consent_ledger_version: number | null
          consent_tier: string | null
          dims: Json
          egress_skipped_reason: string | null
          egressed_at: string | null
          environment: string
          event_type: string
          event_uuid: string | null
          id: number
          org_id: string | null
          payload: Json
          profile_id: string | null
          schema_version: string
          server_ts: string | null
          session_id: string | null
          tenant_hash: string
          ts: string
          workspace_type: string | null
        }
        Insert: {
          actor_hash?: string | null
          affiliated?: boolean | null
          classifier_version?: string | null
          client_seq?: number | null
          consent_ledger_version?: number | null
          consent_tier?: string | null
          dims?: Json
          egress_skipped_reason?: string | null
          egressed_at?: string | null
          environment?: string
          event_type: string
          event_uuid?: string | null
          id?: never
          org_id?: string | null
          payload?: Json
          profile_id?: string | null
          schema_version?: string
          server_ts?: string | null
          session_id?: string | null
          tenant_hash: string
          ts?: string
          workspace_type?: string | null
        }
        Update: {
          actor_hash?: string | null
          affiliated?: boolean | null
          classifier_version?: string | null
          client_seq?: number | null
          consent_ledger_version?: number | null
          consent_tier?: string | null
          dims?: Json
          egress_skipped_reason?: string | null
          egressed_at?: string | null
          environment?: string
          event_type?: string
          event_uuid?: string | null
          id?: never
          org_id?: string | null
          payload?: Json
          profile_id?: string | null
          schema_version?: string
          server_ts?: string | null
          session_id?: string | null
          tenant_hash?: string
          ts?: string
          workspace_type?: string | null
        }
        Relationships: []
      }
      events_v2: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          affiliated: boolean | null
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
          workspace_type: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Relationships: []
      }
      events_v2_2026h2: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          affiliated: boolean | null
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
          workspace_type: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Relationships: []
      }
      events_v2_2027h1: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          affiliated: boolean | null
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
          workspace_type: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Relationships: []
      }
      events_v2_2027h2: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          affiliated: boolean | null
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
          workspace_type: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Relationships: []
      }
      events_v2_default: {
        Row: {
          actor_pseudo: string | null
          actor_type: string
          affiliated: boolean | null
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
          workspace_type: string | null
        }
        Insert: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
        }
        Update: {
          actor_pseudo?: string | null
          actor_type?: string
          affiliated?: boolean | null
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
          workspace_type?: string | null
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
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
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
          session_id: string | null
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
          session_id?: string | null
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
          session_id?: string | null
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
            foreignKeyName: "one_on_one_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_sessions"
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
      one_on_one_sessions: {
        Row: {
          created_at: string
          held_on: string
          id: string
          org_id: string
          owner_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          held_on: string
          id?: string
          org_id: string
          owner_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          held_on?: string
          id?: string
          org_id?: string
          owner_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_affiliations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_affiliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_affiliations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_affiliations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
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
          is_demo: boolean
          name: string
          org_mode: string | null
          settings: Json
          signup_source: string | null
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
          is_demo?: boolean
          name: string
          org_mode?: string | null
          settings?: Json
          signup_source?: string | null
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
          is_demo?: boolean
          name?: string
          org_mode?: string | null
          settings?: Json
          signup_source?: string | null
          size_band?: string | null
          vendor_display?: string
        }
        Relationships: []
      }
      pilot_requests: {
        Row: {
          created_at: string
          email: string
          email_status: string
          firm: string
          id: string
          name: string
          note: string | null
          notify_status: string
          team_size: string
        }
        Insert: {
          created_at?: string
          email: string
          email_status?: string
          firm: string
          id?: string
          name: string
          note?: string | null
          notify_status?: string
          team_size: string
        }
        Update: {
          created_at?: string
          email?: string
          email_status?: string
          firm?: string
          id?: string
          name?: string
          note?: string | null
          notify_status?: string
          team_size?: string
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
          onboarding: Json | null
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
          onboarding?: Json | null
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
          onboarding?: Json | null
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
          engagement_id: string | null
          id: string
          question: string
          scope: string
          subject_id: string
          work_item_id: string | null
        }
        Insert: {
          answer_ref?: string | null
          asker_id: string
          created_at?: string
          engagement_id?: string | null
          id?: string
          question: string
          scope: string
          subject_id: string
          work_item_id?: string | null
        }
        Update: {
          answer_ref?: string | null
          asker_id?: string
          created_at?: string
          engagement_id?: string | null
          id?: string
          question?: string
          scope?: string
          subject_id?: string
          work_item_id?: string | null
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
            foreignKeyName: "query_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_log_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_log_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
      shipped_work: {
        Row: {
          engagement_id: string | null
          id: string
          org_id: string
          shipped_at: string
          shipped_by: string
          work_item_id: string
        }
        Insert: {
          engagement_id?: string | null
          id?: string
          org_id: string
          shipped_at?: string
          shipped_by: string
          work_item_id: string
        }
        Update: {
          engagement_id?: string | null
          id?: string
          org_id?: string
          shipped_at?: string
          shipped_by?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipped_work_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipped_work_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipped_work_shipped_by_fkey"
            columns: ["shipped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipped_work_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      span_links: {
        Row: {
          asked_by: string
          created_at: string
          from_item_id: string
          id: string
          locator: Json
          org_id: string
          owner_id: string
          question: string | null
          quote: string | null
          run_id: string | null
          status: string
          to_item_id: string | null
          to_locator: Json | null
          to_turn_id: string | null
          verification: string
          verification_note: string | null
        }
        Insert: {
          asked_by: string
          created_at?: string
          from_item_id: string
          id?: string
          locator: Json
          org_id: string
          owner_id: string
          question?: string | null
          quote?: string | null
          run_id?: string | null
          status: string
          to_item_id?: string | null
          to_locator?: Json | null
          to_turn_id?: string | null
          verification?: string
          verification_note?: string | null
        }
        Update: {
          asked_by?: string
          created_at?: string
          from_item_id?: string
          id?: string
          locator?: Json
          org_id?: string
          owner_id?: string
          question?: string | null
          quote?: string | null
          run_id?: string | null
          status?: string
          to_item_id?: string | null
          to_locator?: Json | null
          to_turn_id?: string | null
          verification?: string
          verification_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "span_links_asked_by_fkey"
            columns: ["asked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "span_links_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "span_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "span_links_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "span_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "span_links_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "span_links_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          accepted_at: string | null
          created_at: string
          delivered_at: string | null
          detail: string | null
          engagement_id: string
          goal: string | null
          id: string
          is_board_default: boolean
          is_wrap: boolean
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
          accepted_at?: string | null
          created_at?: string
          delivered_at?: string | null
          detail?: string | null
          engagement_id: string
          goal?: string | null
          id?: string
          is_board_default?: boolean
          is_wrap?: boolean
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
          accepted_at?: string | null
          created_at?: string
          delivered_at?: string | null
          detail?: string | null
          engagement_id?: string
          goal?: string | null
          id?: string
          is_board_default?: boolean
          is_wrap?: boolean
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
      turn_revisions: {
        Row: {
          content: string
          content_hash: string
          id: string
          reason: string
          replaced_at: string
          role: string
          turn_id: string
          turn_no: number
          work_item_id: string
        }
        Insert: {
          content: string
          content_hash: string
          id?: string
          reason?: string
          replaced_at?: string
          role: string
          turn_id: string
          turn_no: number
          work_item_id: string
        }
        Update: {
          content?: string
          content_hash?: string
          id?: string
          reason?: string
          replaced_at?: string
          role?: string
          turn_id?: string
          turn_no?: number
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turn_revisions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
      user_active_profile: {
        Row: {
          profile_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          profile_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          profile_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_profile_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      work_item_entities: {
        Row: {
          created_at: string
          entity_key: string
          entity_raw: string
          id: string
          merged_into: string | null
          org_id: string
          owner_id: string
          source: string
          updated_at: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          entity_raw: string
          id?: string
          merged_into?: string | null
          org_id: string
          owner_id: string
          source?: string
          updated_at?: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          entity_raw?: string
          id?: string
          merged_into?: string | null
          org_id?: string
          owner_id?: string
          source?: string
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_entities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_entities_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
          source: string
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
          source?: string
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
          source?: string
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
          client_id: string | null
          content_egress_skipped_reason: string | null
          content_egressed_at: string | null
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
          ungrouped_at: string | null
          visibility: Database["public"]["Enums"]["work_visibility"]
          work_date: string | null
        }
        Insert: {
          captured_at?: string
          client_id?: string | null
          content_egress_skipped_reason?: string | null
          content_egressed_at?: string | null
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
          ungrouped_at?: string | null
          visibility?: Database["public"]["Enums"]["work_visibility"]
          work_date?: string | null
        }
        Update: {
          captured_at?: string
          client_id?: string | null
          content_egress_skipped_reason?: string | null
          content_egressed_at?: string | null
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
          ungrouped_at?: string | null
          visibility?: Database["public"]["Enums"]["work_visibility"]
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
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
      workboard_annotations: {
        Row: {
          anchor_kind: string
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          author_profile_id: string
          body: string
          char_end: number | null
          char_start: number | null
          client_key: string | null
          created_at: string
          created_by: string
          document_version_id: string | null
          excerpt: string | null
          id: string
          kind: string
          legal_hold: boolean
          node_id: string | null
          page_no: number | null
          parent_id: string | null
          purge_after: string | null
          section_key: string | null
          source_hash: string | null
          source_removed_at: string | null
          text_hash: string | null
          turn_hash: string | null
          turn_no: number | null
          updated_at: string
          updated_by: string
          version: number
          visibility: string
          work_item_id: string | null
          workboard_id: string
        }
        Insert: {
          anchor_kind: string
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          author_profile_id: string
          body?: string
          char_end?: number | null
          char_start?: number | null
          client_key?: string | null
          created_at?: string
          created_by: string
          document_version_id?: string | null
          excerpt?: string | null
          id?: string
          kind: string
          legal_hold?: boolean
          node_id?: string | null
          page_no?: number | null
          parent_id?: string | null
          purge_after?: string | null
          section_key?: string | null
          source_hash?: string | null
          source_removed_at?: string | null
          text_hash?: string | null
          turn_hash?: string | null
          turn_no?: number | null
          updated_at?: string
          updated_by: string
          version?: number
          visibility: string
          work_item_id?: string | null
          workboard_id: string
        }
        Update: {
          anchor_kind?: string
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          author_profile_id?: string
          body?: string
          char_end?: number | null
          char_start?: number | null
          client_key?: string | null
          created_at?: string
          created_by?: string
          document_version_id?: string | null
          excerpt?: string | null
          id?: string
          kind?: string
          legal_hold?: boolean
          node_id?: string | null
          page_no?: number | null
          parent_id?: string | null
          purge_after?: string | null
          section_key?: string | null
          source_hash?: string | null
          source_removed_at?: string | null
          text_hash?: string | null
          turn_hash?: string | null
          turn_no?: number | null
          updated_at?: string
          updated_by?: string
          version?: number
          visibility?: string
          work_item_id?: string | null
          workboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workboard_annotations_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workboard_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "workboard_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_annotations_workboard_id_fkey"
            columns: ["workboard_id"]
            isOneToOne: false
            referencedRelation: "workboards"
            referencedColumns: ["id"]
          },
        ]
      }
      workboard_frames: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          fill: string | null
          h: number
          id: string
          key: string
          kind: string
          label: string | null
          ord: number
          task_id: string | null
          updated_at: string
          updated_by: string
          version: number
          w: number
          workboard_id: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          fill?: string | null
          h?: number
          id?: string
          key: string
          kind: string
          label?: string | null
          ord?: number
          task_id?: string | null
          updated_at?: string
          updated_by: string
          version?: number
          w?: number
          workboard_id: string
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          fill?: string | null
          h?: number
          id?: string
          key?: string
          kind?: string
          label?: string | null
          ord?: number
          task_id?: string | null
          updated_at?: string
          updated_by?: string
          version?: number
          w?: number
          workboard_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "workboard_frames_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_frames_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_frames_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_frames_workboard_id_fkey"
            columns: ["workboard_id"]
            isOneToOne: false
            referencedRelation: "workboards"
            referencedColumns: ["id"]
          },
        ]
      }
      workboard_links: {
        Row: {
          author_profile_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          from_anchor: string
          from_node_id: string
          id: string
          relation: string
          to_anchor: string
          to_node_id: string
          updated_at: string
          updated_by: string
          version: number
          workboard_id: string
        }
        Insert: {
          author_profile_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          from_anchor?: string
          from_node_id: string
          id?: string
          relation: string
          to_anchor?: string
          to_node_id: string
          updated_at?: string
          updated_by: string
          version?: number
          workboard_id: string
        }
        Update: {
          author_profile_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          from_anchor?: string
          from_node_id?: string
          id?: string
          relation?: string
          to_anchor?: string
          to_node_id?: string
          updated_at?: string
          updated_by?: string
          version?: number
          workboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workboard_links_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_links_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "workboard_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_links_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "workboard_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_links_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_links_workboard_id_fkey"
            columns: ["workboard_id"]
            isOneToOne: false
            referencedRelation: "workboards"
            referencedColumns: ["id"]
          },
        ]
      }
      workboard_nodes: {
        Row: {
          author_profile_id: string
          body: string
          client_key: string | null
          created_at: string
          created_by: string
          decision_id: string | null
          deleted_at: string | null
          frame_id: string | null
          h: number
          hidden: boolean
          id: string
          judgment_type: string | null
          kind: string
          linked_item_removed_at: string | null
          title: string
          updated_at: string
          updated_by: string
          version: number
          w: number
          work_item_id: string | null
          workboard_id: string
          x: number
          y: number
        }
        Insert: {
          author_profile_id: string
          body?: string
          client_key?: string | null
          created_at?: string
          created_by: string
          decision_id?: string | null
          deleted_at?: string | null
          frame_id?: string | null
          h?: number
          hidden?: boolean
          id?: string
          judgment_type?: string | null
          kind: string
          linked_item_removed_at?: string | null
          title?: string
          updated_at?: string
          updated_by: string
          version?: number
          w?: number
          work_item_id?: string | null
          workboard_id: string
          x?: number
          y?: number
        }
        Update: {
          author_profile_id?: string
          body?: string
          client_key?: string | null
          created_at?: string
          created_by?: string
          decision_id?: string | null
          deleted_at?: string | null
          frame_id?: string | null
          h?: number
          hidden?: boolean
          id?: string
          judgment_type?: string | null
          kind?: string
          linked_item_removed_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
          w?: number
          work_item_id?: string | null
          workboard_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "workboard_nodes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_nodes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_nodes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_nodes_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "workboard_frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_nodes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_nodes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_nodes_workboard_id_fkey"
            columns: ["workboard_id"]
            isOneToOne: false
            referencedRelation: "workboards"
            referencedColumns: ["id"]
          },
        ]
      }
      workboard_revisions: {
        Row: {
          action: string
          actor_profile_id: string
          at: string
          change: Json
          entity_id: string
          entity_kind: string
          id: number
          revision: number
          workboard_id: string
        }
        Insert: {
          action: string
          actor_profile_id: string
          at?: string
          change?: Json
          entity_id: string
          entity_kind: string
          id?: never
          revision: number
          workboard_id: string
        }
        Update: {
          action?: string
          actor_profile_id?: string
          at?: string
          change?: Json
          entity_id?: string
          entity_kind?: string
          id?: never
          revision?: number
          workboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workboard_revisions_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboard_revisions_workboard_id_fkey"
            columns: ["workboard_id"]
            isOneToOne: false
            referencedRelation: "workboards"
            referencedColumns: ["id"]
          },
        ]
      }
      workboards: {
        Row: {
          created_at: string
          created_by: string
          engagement_id: string
          id: string
          legal_hold: boolean
          org_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          engagement_id: string
          id?: string
          legal_hold?: boolean
          org_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          engagement_id?: string
          id?: string
          legal_hold?: boolean
          org_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workboards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboards_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workboards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_org_id: { Args: never; Returns: string }
      active_profile_id: { Args: never; Returns: string }
      analytics_insert: {
        Args: { p_row: Json; p_table: string }
        Returns: undefined
      }
      analytics_label_finding: {
        Args: { p_by_coach: boolean; p_response: string; p_run_id: string }
        Returns: undefined
      }
      analytics_upsert_episode: { Args: { p_row: Json }; Returns: undefined }
      analytics_upsert_feature: { Args: { p_row: Json }; Returns: undefined }
      can_place_in_task: { Args: { p_task: string }; Returns: boolean }
      can_place_item_in_task: {
        Args: { p_item: string; p_task: string }
        Returns: boolean
      }
      can_self_join_engagement: {
        Args: { eng: string; prof: string }
        Returns: boolean
      }
      claim_coaching_links: {
        Args: { p_actor_profile_id?: string; p_code: string }
        Returns: number
      }
      coach_can_see_item: { Args: { item: string }; Returns: boolean }
      coaches_subject: { Args: { subject: string }; Returns: boolean }
      coaching_actor: {
        Args: { p_profile_id: string }
        Returns: {
          created_at: string
          deactivated_at: string | null
          display_name: string
          experience_band: string | null
          function_area: string | null
          id: string
          onboarding: Json | null
          org_id: string
          primary_work_types: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          role_family: string | null
          seniority_band: string | null
          style_label: string | null
          title_band: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consent_to_coaching_link: {
        Args: { p_actor_profile_id?: string; p_link_id: string }
        Returns: undefined
      }
      create_coaching_link: {
        Args: {
          p_access_level?: string
          p_actor_profile_id?: string
          p_agreement_ref?: string
          p_basis?: string
          p_invite_code?: string
          p_relation: string
          p_scope?: string
          p_subject_profile_id: string
        }
        Returns: string
      }
      create_org_with_profile: {
        Args: { p_display_name: string; p_org_name: string }
        Returns: string
      }
      deactivate_member: { Args: { p_profile: string }; Returns: undefined }
      end_coaching_link: {
        Args: { p_actor_profile_id?: string; p_link_id: string }
        Returns: undefined
      }
      engagement_member_can_see_item: {
        Args: { item: string }
        Returns: boolean
      }
      ensure_board_default_task: {
        Args: { p_engagement: string }
        Returns: string
      }
      has_org_role: {
        Args: {
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_active_org: { Args: { o: string }; Returns: boolean }
      is_engagement_editor: { Args: { eng: string }; Returns: boolean }
      is_engagement_member: { Args: { eng: string }; Returns: boolean }
      is_member_of: { Args: { p_org: string }; Returns: boolean }
      is_my_active_profile: { Args: { p: string }; Returns: boolean }
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
      mark_coaching_note_read: {
        Args: { p_note_id: string }
        Returns: undefined
      }
      mcp_actor_ok: {
        Args: { p_actor: string }
        Returns: {
          org_id: string
          role: string
          wtype: string
        }[]
      }
      mcp_create_board: {
        Args: {
          p_actor: string
          p_code?: string
          p_container: string
          p_first_workstream?: string
          p_title: string
        }
        Returns: Json
      }
      mcp_create_container: {
        Args: { p_actor: string; p_name: string }
        Returns: Json
      }
      mcp_place_item: {
        Args: {
          p_actor: string
          p_move?: boolean
          p_task: string
          p_work_item: string
        }
        Returns: Json
      }
      move_item_to_workstream: {
        Args: { p_item: string; p_task: string }
        Returns: Json
      }
      my_org_id: { Args: never; Returns: string }
      my_profile_id: { Args: never; Returns: string }
      my_profile_ids: { Args: never; Returns: string[] }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      purge_workboard_annotations: { Args: never; Returns: number }
      reactivate_member: { Args: { p_profile: string }; Returns: undefined }
      record_coaching_disclosure: {
        Args: { p_actor_profile_id?: string; p_link_id: string }
        Returns: undefined
      }
      set_data_consent: {
        Args: {
          p_consent_text_version?: string
          p_notice_hash?: string
          p_scope: string
          p_surface?: string
          p_tier: string
          p_tier_d_switch?: boolean
        }
        Returns: number
      }
      set_engagement_person_access: {
        Args: { p_access: string; p_engagement: string; p_profile: string }
        Returns: string
      }
      set_firm_check_active: {
        Args: { p_active: boolean; p_check: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_profile: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      share_engagement_with_coach: {
        Args: { p_coach_profile: string; p_engagement: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tier_rank: { Args: { t: string }; Returns: number }
      unshare_engagement_coach: {
        Args: { p_coach_profile: string; p_engagement: string }
        Returns: undefined
      }
      withdraw_coaching_consent: {
        Args: { p_actor_profile_id?: string; p_link_id: string }
        Returns: undefined
      }
      work_file_readable: { Args: { p_name: string }; Returns: boolean }
      workboard_node_readable: { Args: { n: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
