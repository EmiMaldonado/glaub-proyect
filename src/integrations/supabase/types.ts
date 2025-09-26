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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          insights: Json | null
          max_duration_minutes: number | null
          ocean_signals: Json | null
          session_data: Json | null
          started_at: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          insights?: Json | null
          max_duration_minutes?: number | null
          ocean_signals?: Json | null
          session_data?: Json | null
          started_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          insights?: Json | null
          max_duration_minutes?: number | null
          ocean_signals?: Json | null
          session_data?: Json | null
          started_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      individual_recommendations: {
        Row: {
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          leadership_tips: Json
          manager_id: string
          member_analysis: Json
          member_hash: string
          member_id: string
          recommendations: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          leadership_tips?: Json
          manager_id: string
          member_analysis?: Json
          member_hash: string
          member_id: string
          recommendations?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          leadership_tips?: Json
          manager_id?: string
          member_analysis?: Json
          member_hash?: string
          member_id?: string
          recommendations?: Json
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_type: string | null
          invitation_url: string | null
          invited_at: string
          invited_by_id: string | null
          manager_id: string
          message: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invitation_type?: string | null
          invitation_url?: string | null
          invited_at?: string
          invited_by_id?: string | null
          manager_id: string
          message?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_type?: string | null
          invitation_url?: string | null
          invited_at?: string
          invited_by_id?: string | null
          manager_id?: string
          message?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_id_fkey"
            columns: ["invited_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_insights: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          insights: Json | null
          next_steps: Json | null
          personality_notes: Json | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          insights?: Json | null
          next_steps?: Json | null
          personality_notes?: Json | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          insights?: Json | null
          next_steps?: Json | null
          personality_notes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_insights_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_employee_relationships: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          manager_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          manager_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          manager_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_employee_relationships_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_employee_relationships_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_recommendations: {
        Row: {
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          manager_id: string
          ocean_description: string | null
          recommendations: Json
          team_analysis: Json
          team_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          manager_id: string
          ocean_description?: string | null
          recommendations?: Json
          team_analysis?: Json
          team_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          manager_id?: string
          ocean_description?: string | null
          recommendations?: Json
          team_analysis?: Json
          team_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      OCEAN_phrases_traingdata: {
        Row: {
          "A key": number | null
          "C key": number | null
          "E key": number | null
          id: number
          "N key": number | null
          "O key": number | null
          Sentence: string | null
        }
        Insert: {
          "A key"?: number | null
          "C key"?: number | null
          "E key"?: number | null
          id?: number
          "N key"?: number | null
          "O key"?: number | null
          Sentence?: string | null
        }
        Update: {
          "A key"?: number | null
          "C key"?: number | null
          "E key"?: number | null
          id?: number
          "N key"?: number | null
          "O key"?: number | null
          Sentence?: string | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_used?: boolean
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      paused_conversations: {
        Row: {
          conversation_title: string | null
          created_at: string
          id: string
          message_history: Json
          user_id: string
        }
        Insert: {
          conversation_title?: string | null
          created_at?: string
          id?: string
          message_history?: Json
          user_id: string
        }
        Update: {
          conversation_title?: string | null
          created_at?: string
          id?: string
          message_history?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          can_be_managed: boolean | null
          can_manage_teams: boolean | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          job_level: string | null
          job_position: string | null
          manager_id: string | null
          onboarding_completed: boolean | null
          organization: string | null
          role: string | null
          team_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          can_be_managed?: boolean | null
          can_manage_teams?: boolean | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          job_level?: string | null
          job_position?: string | null
          manager_id?: string | null
          onboarding_completed?: boolean | null
          organization?: string | null
          role?: string | null
          team_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          can_be_managed?: boolean | null
          can_manage_teams?: boolean | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          job_level?: string | null
          job_position?: string | null
          manager_id?: string | null
          onboarding_completed?: boolean | null
          organization?: string | null
          role?: string | null
          team_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_backup: {
        Row: {
          email: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      sharing_preferences: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          share_conversations: boolean
          share_insights: boolean
          share_manager_recommendations: boolean | null
          share_ocean_profile: boolean
          share_profile: boolean
          share_progress: boolean
          share_strengths: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          share_conversations?: boolean
          share_insights?: boolean
          share_manager_recommendations?: boolean | null
          share_ocean_profile?: boolean
          share_profile?: boolean
          share_progress?: boolean
          share_strengths?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          share_conversations?: boolean
          share_insights?: boolean
          share_manager_recommendations?: boolean | null
          share_ocean_profile?: boolean
          share_profile?: boolean
          share_progress?: boolean
          share_strengths?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sharing_preferences_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          member_id: string
          role: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          member_id: string
          role?: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string
          role?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships_backup: {
        Row: {
          created_at: string | null
          employee_1_id: string | null
          employee_10_id: string | null
          employee_2_id: string | null
          employee_3_id: string | null
          employee_4_id: string | null
          employee_5_id: string | null
          employee_6_id: string | null
          employee_7_id: string | null
          employee_8_id: string | null
          employee_9_id: string | null
          id: string | null
          manager_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_1_id?: string | null
          employee_10_id?: string | null
          employee_2_id?: string | null
          employee_3_id?: string | null
          employee_4_id?: string | null
          employee_5_id?: string | null
          employee_6_id?: string | null
          employee_7_id?: string | null
          employee_8_id?: string | null
          employee_9_id?: string | null
          id?: string | null
          manager_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_1_id?: string | null
          employee_10_id?: string | null
          employee_2_id?: string | null
          employee_3_id?: string | null
          employee_4_id?: string | null
          employee_5_id?: string | null
          employee_6_id?: string | null
          employee_7_id?: string | null
          employee_8_id?: string | null
          employee_9_id?: string | null
          id?: string | null
          manager_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      "training data - conversation": {
        Row: {
          anger: boolean | null
          anticipation: boolean | null
          disgust: boolean | null
          fear: boolean | null
          ID: number
          joy: boolean | null
          negative: boolean | null
          positive: boolean | null
          sadness: boolean | null
          surprise: boolean | null
          trust: boolean | null
          word: string | null
        }
        Insert: {
          anger?: boolean | null
          anticipation?: boolean | null
          disgust?: boolean | null
          fear?: boolean | null
          ID?: number
          joy?: boolean | null
          negative?: boolean | null
          positive?: boolean | null
          sadness?: boolean | null
          surprise?: boolean | null
          trust?: boolean | null
          word?: string | null
        }
        Update: {
          anger?: boolean | null
          anticipation?: boolean | null
          disgust?: boolean | null
          fear?: boolean | null
          ID?: number
          joy?: boolean | null
          negative?: boolean | null
          positive?: boolean | null
          sadness?: boolean | null
          surprise?: boolean | null
          trust?: boolean | null
          word?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_invitation: {
        Args: { invitation_manager_id: string }
        Returns: boolean
      }
      can_manage_teams: {
        Args: { user_profile_id: string }
        Returns: boolean
      }
      can_user_view_shared_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      check_manager_capabilities: {
        Args: { profile_id: string }
        Returns: {
          can_access_dashboard: boolean
          employee_count: number
          has_employees: boolean
          is_manager: boolean
        }[]
      }
      cleanup_expired_reset_tokens: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      clear_conversation_messages: {
        Args: { conversation_uuid: string }
        Returns: undefined
      }
      generate_invitation_url: {
        Args: { invitation_id: string }
        Returns: string
      }
      generate_reset_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_direct_reports: {
        Args: { manager_profile_id: string }
        Returns: {
          employee_email: string
          employee_id: string
          employee_name: string
        }[]
      }
      get_invitation_by_token: {
        Args: { invitation_token: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_type: string
          invited_by_id: string
          manager_id: string
          status: string
        }[]
      }
      get_manager_chain: {
        Args: { employee_profile_id: string }
        Returns: {
          level: number
          manager_id: string
          manager_name: string
        }[]
      }
      get_user_id_from_token: {
        Args: { token_input: string }
        Returns: string
      }
      get_user_manager_id: {
        Args: { user_profile_id: string }
        Returns: string
      }
      get_user_notifications: {
        Args: { target_user_id?: string }
        Returns: {
          created_at: string
          data: Json
          id: string
          message: string
          read: boolean
          title: string
          type: string
        }[]
      }
      get_user_onboarding_status: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      get_user_profile_by_user_id: {
        Args: { target_user_id: string }
        Returns: {
          id: string
          manager_id: string
          role: string
          user_id: string
        }[]
      }
      is_invitation_manager: {
        Args: { invitation_manager_id: string }
        Returns: boolean
      }
      is_invitation_manager_secure: {
        Args: { invitation_manager_id: string }
        Returns: boolean
      }
      is_user_manager_of_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      manager_has_team_members: {
        Args: { manager_profile_id: string }
        Returns: boolean
      }
      migrate_team_memberships: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      send_welcome_notification: {
        Args: {
          notification_type: string
          target_user_id: string
          team_name?: string
        }
        Returns: undefined
      }
      setup_default_sharing_preferences: {
        Args: { target_manager_id: string; target_user_id: string }
        Returns: undefined
      }
      validate_manager_has_employees: {
        Args: { manager_profile_id: string }
        Returns: boolean
      }
      validate_reset_token: {
        Args: { token_input: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
