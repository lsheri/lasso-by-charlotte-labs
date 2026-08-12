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
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          display_name: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          style_label: string | null
          title_band: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          display_name: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          style_label?: string | null
          title_band?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          display_name?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
