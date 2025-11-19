import { supabase } from "@/integrations/supabase/client";

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  status: "nao_iniciado" | "em_progresso" | "concluido";
  tempo_gasto_minutos: number;
  ultima_posicao_video: number;
  quiz_score: number | null;
  quiz_tentativas: number;
  data_inicio: string | null;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
}

export const progressService = {
  /**
   * Obter progresso de uma aula específica
   */
  async getLessonProgress(userId: string, lessonId: string) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Obter todo o progresso do usuário
   */
  async getUserProgress(userId: string) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("*, lessons(*)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Iniciar aula
   */
  async startLesson(userId: string, lessonId: string) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        status: "em_progresso",
        data_inicio: new Date().toISOString(),
      }, {
        onConflict: "user_id,lesson_id"
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualizar progresso de vídeo
   */
  async updateVideoProgress(userId: string, lessonId: string, position: number, totalTime: number) {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        ultima_posicao_video: position,
        tempo_gasto_minutos: Math.floor(totalTime / 60),
        status: "em_progresso",
      }, {
        onConflict: "user_id,lesson_id"
      });

    if (error) throw error;
  },

  /**
   * Marcar aula como concluída
   */
  async completeLesson(userId: string, lessonId: string) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        status: "concluido",
        data_conclusao: new Date().toISOString(),
      }, {
        onConflict: "user_id,lesson_id"
      })
      .select()
      .single();

    if (error) throw error;
    
    // Adicionar pontos
    await this.awardPoints(userId, "completar_aula", lessonId);
    
    return data;
  },

  /**
   * Salvar resultado de quiz
   */
  async saveQuizResult(
    userId: string,
    lessonId: string,
    score: number,
    totalQuestions: number,
    correctAnswers: number
  ) {
    // Salvar no histórico de quiz
    const { error: quizError } = await supabase
      .from("quiz_results")
      .insert({
        user_id: userId,
        lesson_id: lessonId,
        score,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
      });

    if (quizError) throw quizError;

    // Atualizar progresso da aula
    const { error: progressError } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        quiz_score: score,
        quiz_tentativas: 1, // Incrementar depois
        status: score >= 70 ? "concluido" : "em_progresso",
        data_conclusao: score >= 70 ? new Date().toISOString() : null,
      }, {
        onConflict: "user_id,lesson_id"
      });

    if (progressError) throw progressError;

    // Adicionar pontos baseado na performance
    if (score === 100) {
      await this.awardPoints(userId, "quiz_perfeito", lessonId);
    } else if (score >= 70) {
      await this.awardPoints(userId, "quiz_aprovado", lessonId);
    }
  },

  /**
   * Calcular progresso do módulo
   */
  async getModuleProgress(userId: string, moduleId: string) {
    // Buscar todas as aulas do módulo
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("module_id", moduleId)
      .eq("published", true);

    if (!lessons || lessons.length === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    // Buscar progresso do usuário
    const lessonIds = lessons.map((l) => l.id);
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds)
      .eq("status", "concluido");

    const completed = progress?.length || 0;
    const total = lessons.length;
    const percentage = Math.round((completed / total) * 100);

    return { total, completed, percentage };
  },

  /**
   * Verificar se módulo foi completado
   */
  async checkModuleCompletion(userId: string, moduleId: string) {
    const progress = await this.getModuleProgress(userId, moduleId);
    
    if (progress.percentage === 100) {
      // Adicionar pontos por completar módulo
      await this.awardPoints(userId, "completar_modulo", moduleId);
      return true;
    }
    
    return false;
  },

  /**
   * Adicionar pontos ao usuário
   */
  async awardPoints(userId: string, action: string, originId?: string) {
    // Buscar regra de pontuação
    const { data: rule } = await supabase
      .from("gamification_rules")
      .select("pontos")
      .eq("acao", action)
      .eq("ativo", true)
      .single();

    if (!rule) return;

    // Adicionar ao histórico
    await supabase
      .from("points_history")
      .insert({
        user_id: userId,
        pontos: rule.pontos,
        origem: action,
        origem_id: originId,
        descricao: `Pontos por ${action}`,
      });

    // Atualizar total de XP do usuário
    const { data: currentStats } = await supabase
      .from("user_stats")
      .select("total_xp")
      .eq("user_id", userId)
      .single();

    const newXP = (currentStats?.total_xp || 0) + rule.pontos;

    await supabase
      .from("user_stats")
      .update({ total_xp: newXP })
      .eq("user_id", userId);
  },

  /**
   * Obter histórico de pontos
   */
  async getPointsHistory(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from("points_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};