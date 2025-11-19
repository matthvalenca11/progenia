import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Use database types directly
export type Quiz = Tables<"quizzes">;
export type QuizPergunta = Tables<"quiz_perguntas">;
export type QuizAlternativa = Tables<"quiz_alternativas">;
export type QuizTentativa = Tables<"quiz_tentativas">;
export type QuizMetricas = Tables<"quiz_metricas_usuario">;
export type QuizRecomendacao = Tables<"quiz_recomendacoes">;

// Insert types
export type QuizInsert = TablesInsert<"quizzes">;
export type QuizPerguntaInsert = TablesInsert<"quiz_perguntas">;
export type QuizAlternativaInsert = TablesInsert<"quiz_alternativas">;
export type QuizTentativaInsert = TablesInsert<"quiz_tentativas">;

// Update types
export type QuizUpdate = TablesUpdate<"quizzes">;
export type QuizPerguntaUpdate = TablesUpdate<"quiz_perguntas">;
export type QuizAlternativaUpdate = TablesUpdate<"quiz_alternativas">;

export const quizService = {
  // ==================== QUIZ CRUD ====================
  
  async getQuizzesByLesson(lessonId: string): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('aula_id', lessonId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getQuizById(quizId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async createQuiz(quiz: QuizInsert): Promise<Quiz> {
    const { data, error } = await supabase
      .from('quizzes')
      .insert(quiz)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateQuiz(quizId: string, updates: QuizUpdate): Promise<Quiz> {
    const { data, error } = await supabase
      .from('quizzes')
      .update(updates)
      .eq('id', quizId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteQuiz(quizId: string): Promise<void> {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);
    
    if (error) throw error;
  },

  // ==================== PERGUNTAS CRUD ====================

  async getPerguntasByQuiz(quizId: string): Promise<(QuizPergunta & { alternativas: QuizAlternativa[] })[]> {
    const { data: perguntas, error: perguntasError } = await supabase
      .from('quiz_perguntas')
      .select('*')
      .eq('quiz_id', quizId)
      .order('ordem', { ascending: true });
    
    if (perguntasError) throw perguntasError;

    const perguntasComAlternativas = await Promise.all(
      (perguntas || []).map(async (pergunta) => {
        const { data: alternativas, error: altError } = await supabase
          .from('quiz_alternativas')
          .select('*')
          .eq('pergunta_id', pergunta.id)
          .order('ordem_base', { ascending: true });
        
        if (altError) throw altError;
        return { ...pergunta, alternativas: alternativas || [] };
      })
    );

    return perguntasComAlternativas;
  },

  async createPergunta(pergunta: QuizPerguntaInsert): Promise<QuizPergunta> {
    const { data, error } = await supabase
      .from('quiz_perguntas')
      .insert(pergunta)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updatePergunta(perguntaId: string, updates: QuizPerguntaUpdate): Promise<QuizPergunta> {
    const { data, error } = await supabase
      .from('quiz_perguntas')
      .update(updates)
      .eq('id', perguntaId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletePergunta(perguntaId: string): Promise<void> {
    const { error } = await supabase
      .from('quiz_perguntas')
      .delete()
      .eq('id', perguntaId);
    
    if (error) throw error;
  },

  // ==================== ALTERNATIVAS CRUD ====================

  async createAlternativa(alternativa: QuizAlternativaInsert): Promise<QuizAlternativa> {
    const { data, error } = await supabase
      .from('quiz_alternativas')
      .insert(alternativa)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateAlternativa(alternativaId: string, updates: QuizAlternativaUpdate): Promise<QuizAlternativa> {
    const { data, error } = await supabase
      .from('quiz_alternativas')
      .update(updates)
      .eq('id', alternativaId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteAlternativa(alternativaId: string): Promise<void> {
    const { error } = await supabase
      .from('quiz_alternativas')
      .delete()
      .eq('id', alternativaId);
    
    if (error) throw error;
  },

  // ==================== TENTATIVAS ====================

  async getUserAttempts(userId: string, quizId: string): Promise<QuizTentativa[]> {
    const { data, error } = await supabase
      .from('quiz_tentativas')
      .select('*')
      .eq('usuario_id', userId)
      .eq('quiz_id', quizId)
      .order('numero_tentativa', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async createAttempt(tentativa: QuizTentativaInsert): Promise<QuizTentativa> {
    const { data, error } = await supabase
      .from('quiz_tentativas')
      .insert(tentativa)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async saveAttemptAnswer(resposta: {
    tentativa_id: string;
    pergunta_id: string;
    alternativa_id_escolhida?: string | null;
    resposta_texto?: string | null;
    correta: boolean;
    tempo_resposta_segundos?: number | null;
  }): Promise<void> {
    const { error } = await supabase
      .from('quiz_tentativa_respostas')
      .insert(resposta);
    
    if (error) throw error;
  },

  // ==================== MÉTRICAS E ANALYTICS ====================

  async getUserMetrics(userId: string, quizId: string): Promise<QuizMetricas | null> {
    const { data, error } = await supabase
      .from('quiz_metricas_usuario')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async updateMetrics(userId: string, quizId: string, tentativa: QuizTentativa, respostas: any[]): Promise<void> {
    // Calcular métricas
    const tempoMedio = tentativa.tempo_gasto_segundos ? 
      tentativa.tempo_gasto_segundos / respostas.length : 0;

    // Calcular acertos por dificuldade
    const acertosPorDificuldade = {
      facil: 0,
      medio: 0,
      dificil: 0,
      total_facil: 0,
      total_medio: 0,
      total_dificil: 0
    };

    for (const resposta of respostas) {
      const { data: pergunta } = await supabase
        .from('quiz_perguntas')
        .select('nivel_dificuldade')
        .eq('id', resposta.pergunta_id)
        .single();
      
      if (pergunta) {
        const nivel = pergunta.nivel_dificuldade as 'facil' | 'medio' | 'dificil';
        acertosPorDificuldade[`total_${nivel}`]++;
        if (resposta.correta) {
          acertosPorDificuldade[nivel]++;
        }
      }
    }

    const mediaAcertoPorDificuldade = {
      facil: acertosPorDificuldade.total_facil > 0 ? 
        acertosPorDificuldade.facil / acertosPorDificuldade.total_facil : 0,
      medio: acertosPorDificuldade.total_medio > 0 ? 
        acertosPorDificuldade.medio / acertosPorDificuldade.total_medio : 0,
      dificil: acertosPorDificuldade.total_dificil > 0 ? 
        acertosPorDificuldade.dificil / acertosPorDificuldade.total_dificil : 0,
    };

    // Identificar tópicos difíceis (tags com menos de 50% de acerto)
    const topicosPorTag: Record<string, { acertos: number; total: number }> = {};
    
    for (const resposta of respostas) {
      const { data: pergunta } = await supabase
        .from('quiz_perguntas')
        .select('tags')
        .eq('id', resposta.pergunta_id)
        .single();
      
      if (pergunta && pergunta.tags) {
        for (const tag of pergunta.tags) {
          if (!topicosPorTag[tag]) {
            topicosPorTag[tag] = { acertos: 0, total: 0 };
          }
          topicosPorTag[tag].total++;
          if (resposta.correta) {
            topicosPorTag[tag].acertos++;
          }
        }
      }
    }

    const topicosDificeis = Object.entries(topicosPorTag)
      .filter(([_, stats]) => stats.acertos / stats.total < 0.5)
      .map(([tag]) => tag);

    // Buscar métricas anteriores para calcular evolução
    const metricasAnteriores = await this.getUserMetrics(userId, quizId);
    const taxaEvolucao = metricasAnteriores ? 
      Math.max(0, Math.min(1, (tentativa.pontuacao_percentual - metricasAnteriores.melhor_pontuacao) / 100)) : 0;

    // Upsert métricas
    const { error } = await supabase
      .from('quiz_metricas_usuario')
      .upsert({
        user_id: userId,
        quiz_id: quizId,
        media_tempo_resposta: tempoMedio,
        media_acerto_por_dificuldade: mediaAcertoPorDificuldade as any,
        topicos_dificeis: topicosDificeis,
        taxa_evolucao: taxaEvolucao,
        total_tentativas: (metricasAnteriores?.total_tentativas || 0) + 1,
        melhor_pontuacao: Math.max(
          tentativa.pontuacao_percentual,
          metricasAnteriores?.melhor_pontuacao || 0
        )
      }, {
        onConflict: 'user_id,quiz_id'
      });

    if (error) throw error;
  },

  async generateRecommendations(userId: string, quizId: string, metricas: QuizMetricas): Promise<void> {
    let recomendacao = '';
    const topicosRevisar: string[] = [];

    // Parse the JSON field
    const mediaAcertos = metricas.media_acerto_por_dificuldade as any as {
      facil: number;
      medio: number;
      dificil: number;
    };

    // Analisar desempenho por dificuldade
    if (mediaAcertos.dificil < 0.5) {
      recomendacao += 'Você teve dificuldade nas questões difíceis. ';
      topicosRevisar.push('questões avançadas');
    }
    
    if (mediaAcertos.medio < 0.6) {
      recomendacao += 'Revise os conceitos intermediários. ';
    }

    // Tópicos específicos
    if (metricas.topicos_dificeis.length > 0) {
      recomendacao += `Foque em revisar: ${metricas.topicos_dificeis.join(', ')}. `;
      topicosRevisar.push(...metricas.topicos_dificeis);
    }

    // Evolução
    if (metricas.taxa_evolucao > 0.1) {
      recomendacao += 'Você está evoluindo bem! Continue praticando. ';
    } else if (metricas.total_tentativas > 1) {
      recomendacao += 'Considere revisar a aula antes de tentar novamente. ';
    }

    if (recomendacao) {
      const { error } = await supabase
        .from('quiz_recomendacoes')
        .insert({
          user_id: userId,
          quiz_id: quizId,
          recomendacao_gerada: recomendacao.trim(),
          topicos_revisar: topicosRevisar
        });
      
      if (error) throw error;
    }
  },

  async getUserRecommendations(userId: string, quizId: string): Promise<QuizRecomendacao[]> {
    const { data, error } = await supabase
      .from('quiz_recomendacoes')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // ==================== ADMIN ANALYTICS ====================

  async getQuizStatistics(quizId: string): Promise<{
    totalAttempts: number;
    approvalRate: number;
    averageScore: number;
    averageTime: number;
    mostMissedQuestions: any[];
  }> {
    const { data: tentativas, error } = await supabase
      .from('quiz_tentativas')
      .select('*')
      .eq('quiz_id', quizId);
    
    if (error) throw error;

    const totalAttempts = tentativas?.length || 0;
    const approvals = tentativas?.filter(t => t.aprovado).length || 0;
    const approvalRate = totalAttempts > 0 ? (approvals / totalAttempts) * 100 : 0;
    
    const totalScore = tentativas?.reduce((sum, t) => sum + t.pontuacao_percentual, 0) || 0;
    const averageScore = totalAttempts > 0 ? totalScore / totalAttempts : 0;

    const totalTime = tentativas?.reduce((sum, t) => sum + (t.tempo_gasto_segundos || 0), 0) || 0;
    const averageTime = totalAttempts > 0 ? totalTime / totalAttempts : 0;

    return {
      totalAttempts,
      approvalRate,
      averageScore,
      averageTime,
      mostMissedQuestions: [] // TODO: implementar análise detalhada
    };
  }
};
