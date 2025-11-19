import { supabase } from "@/integrations/supabase/client";
import { progressService } from "./progressService";

interface QuizTentativaInput {
  numero_tentativa: number;
  pontuacao_percentual: number;
  aprovado: boolean;
  tempo_gasto_segundos: number | null;
}

export const quizGamificationService = {
  // Verificar e premiar badges após tentativa de quiz
  async checkAndAwardQuizBadges(
    userId: string, 
    quizId: string,
    tentativa: QuizTentativaInput
  ): Promise<void> {
    // Badge: Primeiro Quiz Concluído
    await this.checkFirstQuizBadge(userId);

    // Badge: Perfeccionista (100% de acertos)
    if (tentativa.pontuacao_percentual === 100) {
      await this.awardBadge(userId, 'perfeccionista');
    }

    // Badge: Persistência (aprovado na segunda tentativa após reprovar na primeira)
    if (tentativa.numero_tentativa === 2 && tentativa.aprovado) {
      await this.checkPersistenciaBadge(userId, quizId);
    }

    // Badge: Mestre do Tempo (tempo recorde)
    if (tentativa.tempo_gasto_segundos && tentativa.aprovado) {
      await this.checkTempoRecordeBadge(userId, quizId, tentativa.tempo_gasto_segundos);
    }

    // Badge: Especialista em RM (domínio em quizzes de RM)
    await this.checkEspecialistaBadge(userId, 'RM');
  },

  async checkFirstQuizBadge(userId: string): Promise<void> {
    // Verificar se já tem tentativas aprovadas
    const { data: tentativas } = await supabase
      .from('quiz_tentativas')
      .select('id')
      .eq('usuario_id', userId)
      .eq('aprovado', true)
      .limit(1);
    
    if (tentativas && tentativas.length === 1) {
      await this.awardBadge(userId, 'primeiro_quiz');
    }
  },

  async checkPersistenciaBadge(userId: string, quizId: string): Promise<void> {
    const { data: tentativas } = await supabase
      .from('quiz_tentativas')
      .select('*')
      .eq('usuario_id', userId)
      .eq('quiz_id', quizId)
      .order('numero_tentativa', { ascending: true })
      .limit(2);
    
    if (tentativas && tentativas.length === 2) {
      if (!tentativas[0].aprovado && tentativas[1].aprovado) {
        await this.awardBadge(userId, 'persistencia');
      }
    }
  },

  async checkTempoRecordeBadge(userId: string, quizId: string, tempoAtual: number): Promise<void> {
    // Buscar o tempo médio de todas as tentativas aprovadas deste quiz
    const { data: tentativas } = await supabase
      .from('quiz_tentativas')
      .select('tempo_gasto_segundos')
      .eq('quiz_id', quizId)
      .eq('aprovado', true)
      .not('tempo_gasto_segundos', 'is', null);
    
    if (tentativas && tentativas.length > 5) {
      const tempos = tentativas.map(t => t.tempo_gasto_segundos as number);
      const tempoMedio = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      
      // Se o tempo atual é 30% menor que a média, é recorde
      if (tempoAtual < tempoMedio * 0.7) {
        await this.awardBadge(userId, 'tempo_recorde');
      }
    }
  },

  async checkEspecialistaBadge(userId: string, topico: string): Promise<void> {
    // Buscar quizzes com tag específica
    const { data: perguntas } = await supabase
      .from('quiz_perguntas')
      .select('quiz_id')
      .contains('tags', [topico]);
    
    if (!perguntas) return;

    const quizIds = [...new Set(perguntas.map(p => p.quiz_id))];

    // Verificar desempenho nesses quizzes
    let quizzesComBomDesempenho = 0;

    for (const quizId of quizIds) {
      const { data: metricas } = await supabase
        .from('quiz_metricas_usuario')
        .select('melhor_pontuacao')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .maybeSingle();
      
      if (metricas && metricas.melhor_pontuacao >= 80) {
        quizzesComBomDesempenho++;
      }
    }

    // Se acertou 80% ou mais em 3+ quizzes do tópico
    if (quizzesComBomDesempenho >= 3) {
      await this.awardBadge(userId, 'especialista_rm');
    }
  },

  async awardBadge(userId: string, badgeTipo: string): Promise<void> {
    // Buscar badge pelo critério
    const { data: badges } = await supabase
      .from('badges')
      .select('id, name, pontos_recompensa, criteria')
      .eq('categoria', 'quiz');
    
    const badge = badges?.find((b: any) => 
      b.criteria && typeof b.criteria === 'object' && b.criteria.tipo === badgeTipo
    );
    
    if (!badge) return;

    // Verificar se já possui
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', badge.id)
      .maybeSingle();
    
    if (existing) return;

    // Conceder badge
    const { error } = await supabase
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_id: badge.id
      });
    
    if (error) {
      console.error('Erro ao conceder badge:', error);
      return;
    }

    // Adicionar pontos
    await progressService.awardPoints(userId, 'badge_conquistado', badge.id);
  },

  // Calcular e premiar pontos baseado em acertos
  async awardQuizPoints(
    userId: string,
    quizId: string,
    respostas: Array<{
      pergunta_id: string;
      correta: boolean;
    }>,
    aprovado: boolean,
    completouTentativas: boolean
  ): Promise<void> {
    let pontosTotal = 0;

    // Pontos por acerto baseado em dificuldade
    for (const resposta of respostas) {
      if (resposta.correta) {
        const { data: pergunta } = await supabase
          .from('quiz_perguntas')
          .select('nivel_dificuldade')
          .eq('id', resposta.pergunta_id)
          .single();
        
        if (pergunta) {
          const acao = `quiz_acerto_${pergunta.nivel_dificuldade}`;
          await progressService.awardPoints(userId, acao, quizId);
          
          // Calcular pontos localmente para display
          const { data: rule } = await supabase
            .from('gamification_rules')
            .select('pontos')
            .eq('acao', acao)
            .eq('ativo', true)
            .maybeSingle();
          
          if (rule) {
            pontosTotal += rule.pontos;
          }
        }
      }
    }

    // Bônus por aprovação
    if (aprovado) {
      await progressService.awardPoints(userId, 'quiz_aprovado', quizId);
      
      const { data: rule } = await supabase
        .from('gamification_rules')
        .select('pontos')
        .eq('acao', 'quiz_aprovado')
        .eq('ativo', true)
        .maybeSingle();
      
      if (rule) {
        pontosTotal += rule.pontos;
      }
    }

    // Bônus por completar todas tentativas
    if (completouTentativas) {
      await progressService.awardPoints(userId, 'quiz_completar_tentativas', quizId);
      
      const { data: rule } = await supabase
        .from('gamification_rules')
        .select('pontos')
        .eq('acao', 'quiz_completar_tentativas')
        .eq('ativo', true)
        .maybeSingle();
      
      if (rule) {
        pontosTotal += rule.pontos;
      }
    }
  }
};
