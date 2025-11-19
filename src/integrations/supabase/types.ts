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
          categoria: string | null
          created_at: string | null
          criteria: Json | null
          description: string | null
          icon: string | null
          id: string
          name: string
          ordem: number | null
          pontos_recompensa: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          ordem?: number | null
          pontos_recompensa?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          ordem?: number | null
          pontos_recompensa?: number | null
        }
        Relationships: []
      }
      capsula_progresso_usuario: {
        Row: {
          acertos_quiz: number
          capsula_id: string
          concluida: boolean
          id: string
          tentativas: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          acertos_quiz?: number
          capsula_id: string
          concluida?: boolean
          id?: string
          tentativas?: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          acertos_quiz?: number
          capsula_id?: string
          concluida?: boolean
          id?: string
          tentativas?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsula_progresso_usuario_capsula_id_fkey"
            columns: ["capsula_id"]
            isOneToOne: false
            referencedRelation: "capsulas"
            referencedColumns: ["id"]
          },
        ]
      }
      capsula_quiz_alternativas: {
        Row: {
          correta: boolean
          created_at: string
          id: string
          micro_feedback: string | null
          ordem_base: number
          pergunta_id: string
          texto: string
        }
        Insert: {
          correta?: boolean
          created_at?: string
          id?: string
          micro_feedback?: string | null
          ordem_base?: number
          pergunta_id: string
          texto: string
        }
        Update: {
          correta?: boolean
          created_at?: string
          id?: string
          micro_feedback?: string | null
          ordem_base?: number
          pergunta_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsula_quiz_alternativas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "capsula_quiz_perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      capsula_quiz_perguntas: {
        Row: {
          capsula_id: string
          created_at: string
          enunciado: string
          id: string
          ordem: number
          tipo: string
        }
        Insert: {
          capsula_id: string
          created_at?: string
          enunciado: string
          id?: string
          ordem?: number
          tipo?: string
        }
        Update: {
          capsula_id?: string
          created_at?: string
          enunciado?: string
          id?: string
          ordem?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsula_quiz_perguntas_capsula_id_fkey"
            columns: ["capsula_id"]
            isOneToOne: false
            referencedRelation: "capsulas"
            referencedColumns: ["id"]
          },
        ]
      }
      capsulas: {
        Row: {
          ativo: boolean
          capa_path: string | null
          categoria: string
          created_at: string
          id: string
          modulo_id: string
          ordem: number
          pergunta_gatilho: string
          takeaway: string
          texto_curto: string
          tipo_lab: string | null
          tipo_visual: string
          titulo: string
          ultrasound_lab_config: Json | null
          updated_at: string
          virtual_lab_id: string | null
          visual_path: string | null
        }
        Insert: {
          ativo?: boolean
          capa_path?: string | null
          categoria: string
          created_at?: string
          id?: string
          modulo_id: string
          ordem?: number
          pergunta_gatilho: string
          takeaway: string
          texto_curto: string
          tipo_lab?: string | null
          tipo_visual: string
          titulo: string
          ultrasound_lab_config?: Json | null
          updated_at?: string
          virtual_lab_id?: string | null
          visual_path?: string | null
        }
        Update: {
          ativo?: boolean
          capa_path?: string | null
          categoria?: string
          created_at?: string
          id?: string
          modulo_id?: string
          ordem?: number
          pergunta_gatilho?: string
          takeaway?: string
          texto_curto?: string
          tipo_lab?: string | null
          tipo_visual?: string
          titulo?: string
          ultrasound_lab_config?: Json | null
          updated_at?: string
          virtual_lab_id?: string | null
          visual_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capsulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capsulas_virtual_lab_id_fkey"
            columns: ["virtual_lab_id"]
            isOneToOne: false
            referencedRelation: "virtual_labs"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_rules: {
        Row: {
          acao: string
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          pontos: number
          updated_at: string | null
        }
        Insert: {
          acao: string
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          pontos: number
          updated_at?: string | null
        }
        Update: {
          acao?: string
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          pontos?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          lesson_id: string
          quiz_score: number | null
          quiz_tentativas: number | null
          status: Database["public"]["Enums"]["progress_status"] | null
          tempo_gasto_minutos: number | null
          ultima_posicao_video: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          lesson_id: string
          quiz_score?: number | null
          quiz_tentativas?: number | null
          status?: Database["public"]["Enums"]["progress_status"] | null
          tempo_gasto_minutos?: number | null
          ultima_posicao_video?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          lesson_id?: string
          quiz_score?: number | null
          quiz_tentativas?: number | null
          status?: Database["public"]["Enums"]["progress_status"] | null
          tempo_gasto_minutos?: number | null
          ultima_posicao_video?: number | null
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
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          assets: Json | null
          content_data: Json | null
          content_type: string
          content_url: string | null
          conteudo_rich_text: string | null
          created_at: string | null
          descricao_curta: string | null
          duration_minutes: number | null
          id: string
          module_id: string
          order_index: number | null
          published: boolean | null
          recursos: Json | null
          title: string
          updated_at: string | null
          video_external_url: string | null
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          assets?: Json | null
          content_data?: Json | null
          content_type: string
          content_url?: string | null
          conteudo_rich_text?: string | null
          created_at?: string | null
          descricao_curta?: string | null
          duration_minutes?: number | null
          id?: string
          module_id: string
          order_index?: number | null
          published?: boolean | null
          recursos?: Json | null
          title: string
          updated_at?: string | null
          video_external_url?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          assets?: Json | null
          content_data?: Json | null
          content_type?: string
          content_url?: string | null
          conteudo_rich_text?: string | null
          created_at?: string | null
          descricao_curta?: string | null
          duration_minutes?: number | null
          id?: string
          module_id?: string
          order_index?: number | null
          published?: boolean | null
          recursos?: Json | null
          title?: string
          updated_at?: string | null
          video_external_url?: string | null
          video_storage_path?: string | null
          video_url?: string | null
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
          enrolled_at: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          enrolled_at?: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          enrolled_at?: string
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
          category: string | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          estimated_hours: number | null
          id: string
          order_index: number | null
          published: boolean | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_hours?: number | null
          id?: string
          order_index?: number | null
          published?: boolean | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_hours?: number | null
          id?: string
          order_index?: number | null
          published?: boolean | null
          thumbnail_url?: string | null
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
          logo_url: string | null
          name: string
          ordem: number | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          ordem?: number | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          ordem?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      points_history: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          origem: string
          origem_id: string | null
          pontos: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          origem: string
          origem_id?: string | null
          pontos: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          origem?: string
          origem_id?: string | null
          pontos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string | null
          descricao: string | null
          full_name: string
          id: string
          institution: string | null
          papel: Database["public"]["Enums"]["user_role"] | null
          professional_role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          descricao?: string | null
          full_name: string
          id: string
          institution?: string | null
          papel?: Database["public"]["Enums"]["user_role"] | null
          professional_role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          descricao?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          papel?: Database["public"]["Enums"]["user_role"] | null
          professional_role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quiz_alternativas: {
        Row: {
          correta: boolean
          created_at: string
          explicacao_feedback: string | null
          id: string
          ordem_base: number
          pergunta_id: string
          texto: string
        }
        Insert: {
          correta?: boolean
          created_at?: string
          explicacao_feedback?: string | null
          id?: string
          ordem_base: number
          pergunta_id: string
          texto: string
        }
        Update: {
          correta?: boolean
          created_at?: string
          explicacao_feedback?: string | null
          id?: string
          ordem_base?: number
          pergunta_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_alternativas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "quiz_perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_metricas_usuario: {
        Row: {
          id: string
          media_acerto_por_dificuldade: Json | null
          media_tempo_resposta: number | null
          melhor_pontuacao: number | null
          quiz_id: string
          taxa_evolucao: number | null
          topicos_dificeis: string[] | null
          total_tentativas: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          media_acerto_por_dificuldade?: Json | null
          media_tempo_resposta?: number | null
          melhor_pontuacao?: number | null
          quiz_id: string
          taxa_evolucao?: number | null
          topicos_dificeis?: string[] | null
          total_tentativas?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          media_acerto_por_dificuldade?: Json | null
          media_tempo_resposta?: number | null
          melhor_pontuacao?: number | null
          quiz_id?: string
          taxa_evolucao?: number | null
          topicos_dificeis?: string[] | null
          total_tentativas?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_metricas_usuario_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_perguntas: {
        Row: {
          created_at: string
          enunciado: string
          id: string
          imagem_url: string | null
          nivel_dificuldade: string
          ordem: number
          quiz_id: string
          tags: string[] | null
          tipo: string
        }
        Insert: {
          created_at?: string
          enunciado: string
          id?: string
          imagem_url?: string | null
          nivel_dificuldade?: string
          ordem: number
          quiz_id: string
          tags?: string[] | null
          tipo?: string
        }
        Update: {
          created_at?: string
          enunciado?: string
          id?: string
          imagem_url?: string | null
          nivel_dificuldade?: string
          ordem?: number
          quiz_id?: string
          tags?: string[] | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_perguntas_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_recomendacoes: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          recomendacao_gerada: string
          topicos_revisar: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          recomendacao_gerada: string
          topicos_revisar?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          recomendacao_gerada?: string
          topicos_revisar?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_recomendacoes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          completed_at: string | null
          correct_answers: number
          id: string
          lesson_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_answers: number
          id?: string
          lesson_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_answers?: number
          id?: string
          lesson_id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_tentativa_respostas: {
        Row: {
          alternativa_id_escolhida: string | null
          correta: boolean
          created_at: string
          id: string
          pergunta_id: string
          resposta_texto: string | null
          tempo_resposta_segundos: number | null
          tentativa_id: string
        }
        Insert: {
          alternativa_id_escolhida?: string | null
          correta: boolean
          created_at?: string
          id?: string
          pergunta_id: string
          resposta_texto?: string | null
          tempo_resposta_segundos?: number | null
          tentativa_id: string
        }
        Update: {
          alternativa_id_escolhida?: string | null
          correta?: boolean
          created_at?: string
          id?: string
          pergunta_id?: string
          resposta_texto?: string | null
          tempo_resposta_segundos?: number | null
          tentativa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tentativa_respostas_alternativa_id_escolhida_fkey"
            columns: ["alternativa_id_escolhida"]
            isOneToOne: false
            referencedRelation: "quiz_alternativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tentativa_respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "quiz_perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tentativa_respostas_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "quiz_tentativas"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_tentativas: {
        Row: {
          acertos: number
          aprovado: boolean
          criado_em: string
          erros: number
          id: string
          numero_tentativa: number
          pontuacao_percentual: number
          quiz_id: string
          tempo_gasto_segundos: number | null
          usuario_id: string
        }
        Insert: {
          acertos: number
          aprovado: boolean
          criado_em?: string
          erros: number
          id?: string
          numero_tentativa: number
          pontuacao_percentual: number
          quiz_id: string
          tempo_gasto_segundos?: number | null
          usuario_id: string
        }
        Update: {
          acertos?: number
          aprovado?: boolean
          criado_em?: string
          erros?: number
          id?: string
          numero_tentativa?: number
          pontuacao_percentual?: number
          quiz_id?: string
          tempo_gasto_segundos?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tentativas_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          aleatorizar_ordem_alternativas: boolean
          aleatorizar_ordem_perguntas: boolean
          ativo: boolean
          aula_id: string
          created_at: string
          descricao: string | null
          feedback_imediato: boolean
          id: string
          modo_de_navegacao: string
          nota_minima_aprovacao: number
          tempo_limite_segundos: number | null
          tentativas_maximas: number
          titulo: string
          updated_at: string
        }
        Insert: {
          aleatorizar_ordem_alternativas?: boolean
          aleatorizar_ordem_perguntas?: boolean
          ativo?: boolean
          aula_id: string
          created_at?: string
          descricao?: string | null
          feedback_imediato?: boolean
          id?: string
          modo_de_navegacao?: string
          nota_minima_aprovacao?: number
          tempo_limite_segundos?: number | null
          tentativas_maximas?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          aleatorizar_ordem_alternativas?: boolean
          aleatorizar_ordem_perguntas?: boolean
          ativo?: boolean
          aula_id?: string
          created_at?: string
          descricao?: string | null
          feedback_imediato?: boolean
          id?: string
          modo_de_navegacao?: string
          nota_minima_aprovacao?: number
          tempo_limite_segundos?: number | null
          tentativas_maximas?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          name: string
          ordem: number | null
          photo_url: string | null
          role: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          name: string
          ordem?: number | null
          photo_url?: string | null
          role: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          name?: string
          ordem?: number | null
          photo_url?: string | null
          role?: string
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
      user_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          last_accessed_at: string | null
          lesson_id: string
          time_spent_minutes: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          lesson_id: string
          time_spent_minutes?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          lesson_id?: string
          time_spent_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
          modules_completed: number | null
          streak_days: number | null
          total_time_minutes: number | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          modules_completed?: number | null
          streak_days?: number | null
          total_time_minutes?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          modules_completed?: number | null
          streak_days?: number | null
          total_time_minutes?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      virtual_labs: {
        Row: {
          config_data: Json
          created_at: string | null
          description: string | null
          id: string
          lab_type: string
          lesson_id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          config_data?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          lab_type: string
          lesson_id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          config_data?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          lab_type?: string
          lesson_id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "virtual_labs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_level: { Args: { total_xp: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "admin"
      lab_type:
        | "mri_viewer"
        | "ultrassom_simulador"
        | "eletroterapia_sim"
        | "termico_sim"
      lesson_type: "video" | "artigo" | "quiz" | "laboratorio_virtual"
      progress_status: "nao_iniciado" | "em_progresso" | "concluido"
      user_role: "aluno" | "instrutor" | "admin"
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
      app_role: ["student", "admin"],
      lab_type: [
        "mri_viewer",
        "ultrassom_simulador",
        "eletroterapia_sim",
        "termico_sim",
      ],
      lesson_type: ["video", "artigo", "quiz", "laboratorio_virtual"],
      progress_status: ["nao_iniciado", "em_progresso", "concluido"],
      user_role: ["aluno", "instrutor", "admin"],
    },
  },
} as const
