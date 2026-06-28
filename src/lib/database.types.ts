export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      acopio_centers: {
        Row: {
          acopio_id: string
          capacity: number | null
          confidence_score: number
          contact_hmac: string | null
          contact_masked: string | null
          current_load: number | null
          dedup_hash: string | null
          event_id: string
          last_verified_at: string | null
          location: Json | null
          managing_org: string | null
          name: string
          needs: Json | null
          status: string
        }
        Insert: {
          acopio_id?: string
          capacity?: number | null
          confidence_score?: number
          contact_hmac?: string | null
          contact_masked?: string | null
          current_load?: number | null
          dedup_hash?: string | null
          event_id: string
          last_verified_at?: string | null
          location?: Json | null
          managing_org?: string | null
          name: string
          needs?: Json | null
          status: string
        }
        Update: {
          acopio_id?: string
          capacity?: number | null
          confidence_score?: number
          contact_hmac?: string | null
          contact_masked?: string | null
          current_load?: number | null
          dedup_hash?: string | null
          event_id?: string
          last_verified_at?: string | null
          location?: Json | null
          managing_org?: string | null
          name?: string
          needs?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "acopio_centers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "acopio_centers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_serving_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      aportes: {
        Row: {
          block_keys: string[] | null
          consolidated_at: string | null
          content_hash: string | null
          created_at: string
          dedup_hash: string | null
          dedup_version: string | null
          entity_type: string | null
          external_id: string | null
          id: string
          normalizer_version: string | null
          parser_version: string | null
          raw_artifact_id: string | null
          raw_json: Json | null
          raw_text: string | null
          run_id: string | null
          scraper_id: string | null
          source_id: string | null
          source_record_id: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          block_keys?: string[] | null
          consolidated_at?: string | null
          content_hash?: string | null
          created_at?: string
          dedup_hash?: string | null
          dedup_version?: string | null
          entity_type?: string | null
          external_id?: string | null
          id?: string
          normalizer_version?: string | null
          parser_version?: string | null
          raw_artifact_id?: string | null
          raw_json?: Json | null
          raw_text?: string | null
          run_id?: string | null
          scraper_id?: string | null
          source_id?: string | null
          source_record_id?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          block_keys?: string[] | null
          consolidated_at?: string | null
          content_hash?: string | null
          created_at?: string
          dedup_hash?: string | null
          dedup_version?: string | null
          entity_type?: string | null
          external_id?: string | null
          id?: string
          normalizer_version?: string | null
          parser_version?: string | null
          raw_artifact_id?: string | null
          raw_json?: Json | null
          raw_text?: string | null
          run_id?: string | null
          scraper_id?: string | null
          source_id?: string | null
          source_record_id?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aportes_scraper_id_fkey"
            columns: ["scraper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      dedup_candidates: {
        Row: {
          candidate_id: string
          created_at: string
          decision: string
          event_id: string
          left_person: string
          priority: string
          reasons: Json | null
          right_person: string
          score: number
        }
        Insert: {
          candidate_id?: string
          created_at?: string
          decision?: string
          event_id: string
          left_person: string
          priority: string
          reasons?: Json | null
          right_person: string
          score: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          decision?: string
          event_id?: string
          left_person?: string
          priority?: string
          reasons?: Json | null
          right_person?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "dedup_candidates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "dedup_candidates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_serving_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "dedup_candidates_left_person_fkey"
            columns: ["left_person"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "dedup_candidates_left_person_fkey"
            columns: ["left_person"]
            isOneToOne: false
            referencedRelation: "public_serving_persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "dedup_candidates_right_person_fkey"
            columns: ["right_person"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "dedup_candidates_right_person_fkey"
            columns: ["right_person"]
            isOneToOne: false
            referencedRelation: "public_serving_persons"
            referencedColumns: ["person_record_id"]
          },
        ]
      }
      dedup_decisions: {
        Row: {
          aporte_id: string | null
          canonical_id: string | null
          decided_at: string
          decision: string
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          aporte_id?: string | null
          canonical_id?: string | null
          decided_at?: string
          decision: string
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          aporte_id?: string | null
          canonical_id?: string | null
          decided_at?: string
          decision?: string
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dedup_decisions_aporte_id_fkey"
            columns: ["aporte_id"]
            isOneToOne: false
            referencedRelation: "aportes"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          affected_states: Json | null
          dedup_hash: string | null
          depth_km: number | null
          event_id: string
          event_type: string
          external_ids: Json | null
          magnitude: number | null
          name: string
          occurred_at: string
          status: string
        }
        Insert: {
          affected_states?: Json | null
          dedup_hash?: string | null
          depth_km?: number | null
          event_id?: string
          event_type: string
          external_ids?: Json | null
          magnitude?: number | null
          name: string
          occurred_at: string
          status: string
        }
        Update: {
          affected_states?: Json | null
          dedup_hash?: string | null
          depth_km?: number | null
          event_id?: string
          event_type?: string
          external_ids?: Json | null
          magnitude?: number | null
          name?: string
          occurred_at?: string
          status?: string
        }
        Relationships: []
      }
      partner_api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          owner_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          owner_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_api_keys_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      person_notes: {
        Row: {
          admitted_time: string | null
          confirmed_by: string | null
          deceased_at: string | null
          entry_date: string
          found: boolean | null
          found_at: string | null
          found_by: string | null
          hospital_municipio: string | null
          hospital_name: string | null
          identification_status: string | null
          last_known_location: Json | null
          last_seen_at: string | null
          last_seen_location: Json | null
          note_record_id: string
          note_type: string
          person_record_id: string
          recovery_location: Json | null
          severity: string | null
          source_date: string | null
          status: string
        }
        Insert: {
          admitted_time?: string | null
          confirmed_by?: string | null
          deceased_at?: string | null
          entry_date?: string
          found?: boolean | null
          found_at?: string | null
          found_by?: string | null
          hospital_municipio?: string | null
          hospital_name?: string | null
          identification_status?: string | null
          last_known_location?: Json | null
          last_seen_at?: string | null
          last_seen_location?: Json | null
          note_record_id?: string
          note_type: string
          person_record_id: string
          recovery_location?: Json | null
          severity?: string | null
          source_date?: string | null
          status: string
        }
        Update: {
          admitted_time?: string | null
          confirmed_by?: string | null
          deceased_at?: string | null
          entry_date?: string
          found?: boolean | null
          found_at?: string | null
          found_by?: string | null
          hospital_municipio?: string | null
          hospital_name?: string | null
          identification_status?: string | null
          last_known_location?: Json | null
          last_seen_at?: string | null
          last_seen_location?: Json | null
          note_record_id?: string
          note_type?: string
          person_record_id?: string
          recovery_location?: Json | null
          severity?: string | null
          source_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_notes_person_record_id_fkey"
            columns: ["person_record_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "person_notes_person_record_id_fkey"
            columns: ["person_record_id"]
            isOneToOne: false
            referencedRelation: "public_serving_persons"
            referencedColumns: ["person_record_id"]
          },
        ]
      }
      person_photos: {
        Row: {
          caption: string | null
          person_record_id: string
          photo_id: string
          source_id: string | null
          uploaded_at: string
          url: string
        }
        Insert: {
          caption?: string | null
          person_record_id: string
          photo_id?: string
          source_id?: string | null
          uploaded_at?: string
          url: string
        }
        Update: {
          caption?: string | null
          person_record_id?: string
          photo_id?: string
          source_id?: string | null
          uploaded_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_photos_person_record_id_fkey"
            columns: ["person_record_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "person_photos_person_record_id_fkey"
            columns: ["person_record_id"]
            isOneToOne: false
            referencedRelation: "public_serving_persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "person_photos_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "person_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      person_sources: {
        Row: {
          ext_id: string | null
          fetched_at: string
          person_record_id: string
          source_id: string
          source_url: string
          trust_tier: number
        }
        Insert: {
          ext_id?: string | null
          fetched_at?: string
          person_record_id: string
          source_id?: string
          source_url: string
          trust_tier: number
        }
        Update: {
          ext_id?: string | null
          fetched_at?: string
          person_record_id?: string
          source_id?: string
          source_url?: string
          trust_tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_sources_person_record_id_fkey"
            columns: ["person_record_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["person_record_id"]
          },
          {
            foreignKeyName: "person_sources_person_record_id_fkey"
            columns: ["person_record_id"]
            isOneToOne: false
            referencedRelation: "public_serving_persons"
            referencedColumns: ["person_record_id"]
          },
        ]
      }
      persons: {
        Row: {
          age_range: Json | null
          alternate_names: Json | null
          cedula_hmac: string | null
          cedula_masked: string | null
          confidence_score: number
          event_id: string
          full_name: string | null
          is_minor: boolean | null
          last_known_location: Json | null
          person_record_id: string
          sex: string | null
          source_url: string | null
          status: string
          verification_status: string
        }
        Insert: {
          age_range?: Json | null
          alternate_names?: Json | null
          cedula_hmac?: string | null
          cedula_masked?: string | null
          confidence_score?: number
          event_id: string
          full_name?: string | null
          is_minor?: boolean | null
          last_known_location?: Json | null
          person_record_id?: string
          sex?: string | null
          source_url?: string | null
          status: string
          verification_status: string
        }
        Update: {
          age_range?: Json | null
          alternate_names?: Json | null
          cedula_hmac?: string | null
          cedula_masked?: string | null
          confidence_score?: number
          event_id?: string
          full_name?: string | null
          is_minor?: boolean | null
          last_known_location?: Json | null
          person_record_id?: string
          sex?: string | null
          source_url?: string | null
          status?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "persons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_serving_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          scraper_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          scraper_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          scraper_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scraper_applications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_url: string | null
          source_name: string
          status: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_url?: string | null
          source_name: string
          status?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_url?: string | null
          source_name?: string
          status?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      source_watermarks: {
        Row: {
          source_slug: string
          updated_at: string
          watermark_at: string
        }
        Insert: {
          source_slug: string
          updated_at?: string
          watermark_at?: string
        }
        Update: {
          source_slug?: string
          updated_at?: string
          watermark_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_watermarks_source_slug_fkey"
            columns: ["source_slug"]
            isOneToOne: true
            referencedRelation: "sources"
            referencedColumns: ["slug"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_serving_acopio_centers: {
        Row: {
          acopio_id: string | null
          capacity: number | null
          confidence_score: number | null
          contact_masked: string | null
          current_load: number | null
          event_id: string | null
          last_verified_at: string | null
          location: Json | null
          managing_org: string | null
          name: string | null
          needs: Json | null
          status: string | null
        }
        Insert: {
          acopio_id?: string | null
          capacity?: number | null
          confidence_score?: number | null
          contact_masked?: string | null
          current_load?: number | null
          event_id?: string | null
          last_verified_at?: string | null
          location?: Json | null
          managing_org?: string | null
          name?: string | null
          needs?: Json | null
          status?: string | null
        }
        Update: {
          acopio_id?: string | null
          capacity?: number | null
          confidence_score?: number | null
          contact_masked?: string | null
          current_load?: number | null
          event_id?: string | null
          last_verified_at?: string | null
          location?: Json | null
          managing_org?: string | null
          name?: string | null
          needs?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acopio_centers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "acopio_centers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_serving_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      public_serving_events: {
        Row: {
          affected_states: Json | null
          depth_km: number | null
          event_id: string | null
          event_type: string | null
          external_ids: Json | null
          magnitude: number | null
          name: string | null
          occurred_at: string | null
          status: string | null
        }
        Insert: {
          affected_states?: Json | null
          depth_km?: number | null
          event_id?: string | null
          event_type?: string | null
          external_ids?: Json | null
          magnitude?: number | null
          name?: string | null
          occurred_at?: string | null
          status?: string | null
        }
        Update: {
          affected_states?: Json | null
          depth_km?: number | null
          event_id?: string | null
          event_type?: string | null
          external_ids?: Json | null
          magnitude?: number | null
          name?: string | null
          occurred_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      public_serving_persons: {
        Row: {
          age_range: Json | null
          alternate_names: Json | null
          cedula_hmac: string | null
          cedula_masked: string | null
          confidence_score: number | null
          event_id: string | null
          full_name: string | null
          last_known_location: Json | null
          person_record_id: string | null
          sex: string | null
          source_url: string | null
          status: string | null
          verification_status: string | null
        }
        Insert: {
          age_range?: Json | null
          alternate_names?: Json | null
          cedula_hmac?: string | null
          cedula_masked?: string | null
          confidence_score?: number | null
          event_id?: string | null
          full_name?: string | null
          last_known_location?: Json | null
          person_record_id?: string | null
          sex?: string | null
          source_url?: string | null
          status?: string | null
          verification_status?: string | null
        }
        Update: {
          age_range?: Json | null
          alternate_names?: Json | null
          cedula_hmac?: string | null
          cedula_masked?: string | null
          confidence_score?: number | null
          event_id?: string | null
          full_name?: string | null
          last_known_location?: Json | null
          person_record_id?: string | null
          sex?: string | null
          source_url?: string | null
          status?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "persons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_serving_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
    }
    Functions: {
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      can_ingest: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      user_role: "public_submitter" | "scraper" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["public_submitter", "scraper", "admin"],
    },
  },
} as const

