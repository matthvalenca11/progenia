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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          created_at: string | null
          description: string | null
          icon_name: string
          id: string
          name: string
          points: number | null
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon_name: string
          id?: string
          name: string
          points?: number | null
          requirement_type: string
          requirement_value: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon_name?: string
          id?: string
          name?: string
          points?: number | null
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      capsula_progress: {
        Row: {
          capsula_id: string
          created_at: string | null
          data_conclusao: string | null
          id: string
          progress_percentage: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capsula_id: string
          created_at?: string | null
          data_conclusao?: string | null
          id?: string
          progress_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capsula_id?: string
          created_at?: string | null
          data_conclusao?: string | null
          id?: string
          progress_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsula_progress_capsula_id_fkey"
            columns: ["capsula_id"]
            isOneToOne: false
            referencedRelation: "capsulas"
            referencedColumns: ["id"]
          },
        ]
      }
      capsulas: {
        Row: {
          content_data: Json | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean | null
          module_id: string | null
          order_index: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content_data?: Json | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          module_id?: string | null
          order_index?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content_data?: Json | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          module_id?: string | null
          order_index?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capsulas_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string | null
          default_from_email: string | null
          id: string
          reset_body_intro: string | null
          reset_from_email: string | null
          reset_subject: string | null
          updated_at: string | null
          verification_body_intro: string | null
          verification_from_email: string | null
          verification_subject: string | null
        }
        Insert: {
          created_at?: string | null
          default_from_email?: string | null
          id?: string
          reset_body_intro?: string | null
          reset_from_email?: string | null
          reset_subject?: string | null
          updated_at?: string | null
          verification_body_intro?: string | null
          verification_from_email?: string | null
          verification_subject?: string | null
        }
        Update: {
          created_at?: string | null
          default_from_email?: string | null
          id?: string
          reset_body_intro?: string | null
          reset_from_email?: string | null
          reset_subject?: string | null
          updated_at?: string | null
          verification_body_intro?: string | null
          verification_from_email?: string | null
          verification_subject?: string | null
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          created_at: string | null
          data_conclusao: string | null
          id: string
          lesson_id: string
          progress_percentage: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_conclusao?: string | null
          id?: string
          lesson_id: string
          progress_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_conclusao?: string | null
          id?: string
          lesson_id?: string
          progress_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_data: Json | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean | null
          module_id: string | null
          order_index: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content_data?: Json | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          module_id?: string | null
          order_index?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content_data?: Json | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          module_id?: string | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_enrollments: {
        Row: {
          enrolled_at: string | null
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          enrolled_at?: string | null
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          enrolled_at?: string | null
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_enrollments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          order_index: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          order_index?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          logo_url: string
          name: string
          order_index: number | null
          updated_at: string | null
          website_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url: string
          name: string
          order_index?: number | null
          updated_at?: string | null
          website_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
          website_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string | null
          descricao: string | null
          email: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          institution: string | null
          papel: string | null
          password_reset_expires_at: string | null
          password_reset_token: string | null
          professional_role: string | null
          updated_at: string | null
          verification_expires_at: string | null
          verification_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          descricao?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name: string
          id: string
          institution?: string | null
          papel?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          professional_role?: string | null
          updated_at?: string | null
          verification_expires_at?: string | null
          verification_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          descricao?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          institution?: string | null
          papel?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          professional_role?: string | null
          updated_at?: string | null
          verification_expires_at?: string | null
          verification_token?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          id: string
          passed: boolean
          quiz_id: string
          score: number
          started_at: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          passed: boolean
          quiz_id: string
          score: number
          started_at?: string | null
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          started_at?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean | null
          option_text: string
          order_index: number | null
          question_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          option_text: string
          order_index?: number | null
          question_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          option_text?: string
          order_index?: number | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string | null
          explanation: string | null
          id: string
          order_index: number | null
          points: number | null
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          order_index?: number | null
          points?: number | null
          question_text: string
          question_type: string
          quiz_id: string
        }
        Update: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          order_index?: number | null
          points?: number | null
          question_text?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          lesson_id: string | null
          passing_score: number | null
          time_limit_minutes: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          lesson_id?: string | null
          passing_score?: number | null
          time_limit_minutes?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          lesson_id?: string | null
          passing_score?: number | null
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number | null
          photo_url: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index?: number | null
          photo_url?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number | null
          photo_url?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          id: string
          last_activity_date: string | null
          level: number | null
          streak_days: number | null
          total_lessons_completed: number | null
          total_points: number | null
          total_time_spent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          streak_days?: number | null
          total_lessons_completed?: number | null
          total_points?: number | null
          total_time_spent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          streak_days?: number | null
          total_lessons_completed?: number | null
          total_points?: number | null
          total_time_spent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      virtual_labs: {
        Row: {
          config_data: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          lab_type: string
          name: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          config_data?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          lab_type: string
          name: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          config_data?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          lab_type?: string
          name?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
