import { supabase } from "@/integrations/supabase/client";

export const gamificationService = {
  /**
   * Obter estatísticas do usuário
   */
  async getUserStats(userId: string) {
    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obter badges do usuário
   */
  async getUserBadges(userId: string) {
    const { data, error } = await supabase
      .from("user_badges")
      .select("*, badges(*)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Conceder badge ao usuário
   */
  async awardBadge(userId: string, badgeId: string) {
    // Verificar se já tem o badge
    const { data: existing } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", badgeId)
      .single();

    if (existing) return existing;

    // Conceder badge
    const { data, error } = await supabase
      .from("user_badges")
      .insert({
        user_id: userId,
        badge_id: badgeId,
      })
      .select("*, badges(*)")
      .single();

    if (error) throw error;

    // Se o badge tem pontos de recompensa, adicionar
    if (data.badges.pontos_recompensa) {
      await supabase
        .from("points_history")
        .insert({
          user_id: userId,
          pontos: data.badges.pontos_recompensa,
          origem: "badge",
          origem_id: badgeId,
          descricao: `Badge conquistado: ${data.badges.name}`,
        });

      // Atualizar XP total
      const { data: stats } = await supabase
        .from("user_stats")
        .select("total_xp")
        .eq("user_id", userId)
        .single();

      await supabase
        .from("user_stats")
        .update({ 
          total_xp: (stats?.total_xp || 0) + data.badges.pontos_recompensa 
        })
        .eq("user_id", userId);
    }

    return data;
  },

  /**
   * Verificar e conceder badges automaticamente
   */
  async checkAndAwardBadges(userId: string) {
    // Buscar todos os badges disponíveis
    const { data: badges } = await supabase
      .from("badges")
      .select("*");

    if (!badges) return;

    // Verificar condições de cada badge
    for (const badge of badges) {
      try {
        const shouldAward = await this.checkBadgeCondition(userId, badge);
        if (shouldAward) {
          await this.awardBadge(userId, badge.id);
        }
      } catch (error) {
        console.error(`Erro ao verificar badge ${badge.name}:`, error);
      }
    }
  },

  /**
   * Verificar condição do badge
   */
  async checkBadgeCondition(userId: string, badge: any): Promise<boolean> {
    if (!badge.criteria) return false;

    const criteria = typeof badge.criteria === 'string' 
      ? JSON.parse(badge.criteria) 
      : badge.criteria;

    // Verificar se já tem o badge
    const { data: existing } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", badge.id)
      .single();

    if (existing) return false;

    // Verificar diferentes tipos de condições
    switch (criteria.tipo) {
      case "modulos_completos": {
        const { data: progress } = await supabase
          .from("lesson_progress")
          .select("lesson_id, lessons!inner(module_id)")
          .eq("user_id", userId)
          .eq("status", "concluido");

        // Contar módulos únicos completados
        const uniqueModules = new Set(progress?.map(p => (p.lessons as any).module_id));
        return uniqueModules.size >= criteria.valor;
      }

      case "pontos_totais": {
        const { data: stats } = await supabase
          .from("user_stats")
          .select("total_xp")
          .eq("user_id", userId)
          .single();

        return (stats?.total_xp || 0) >= criteria.valor;
      }

      case "streak_dias": {
        const { data: stats } = await supabase
          .from("user_stats")
          .select("streak_days")
          .eq("user_id", userId)
          .single();

        return (stats?.streak_days || 0) >= criteria.valor;
      }

      case "aulas_completas": {
        const { count } = await supabase
          .from("lesson_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "concluido");

        return (count || 0) >= criteria.valor;
      }

      default:
        return false;
    }
  },

  /**
   * Obter leaderboard
   */
  async getLeaderboard(limit = 10) {
    const { data, error } = await supabase
      .from("user_stats")
      .select("*, profiles(full_name, avatar_url)")
      .order("total_xp", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Atualizar streak do usuário
   */
  async updateStreak(userId: string) {
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!stats) return;

    const hoje = new Date();
    const lastActivity = stats.last_activity_date 
      ? new Date(stats.last_activity_date) 
      : null;

    let newStreak = stats.streak_days || 0;

    if (!lastActivity) {
      // Primeira atividade
      newStreak = 1;
    } else {
      const diffDays = Math.floor(
        (hoje.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        // Sequência continua
        newStreak += 1;
      } else if (diffDays > 1) {
        // Quebrou a sequência
        newStreak = 1;
      }
      // Se diffDays === 0, mantém o streak atual (já praticou hoje)
    }

    await supabase
      .from("user_stats")
      .update({
        streak_days: newStreak,
        last_activity_date: hoje.toISOString().split("T")[0],
      })
      .eq("user_id", userId);
  },

  /**
   * Registrar conclusão de cápsula e conceder pontos
   */
  async rewardCapsulaCompletion(
    userId: string,
    capsulaId: string,
    acertouNaPrimeira: boolean
  ) {
    let pontosBase = 5; // Pontos base por cápsula concluída
    let descricao = "Cápsula concluída";

    if (acertouNaPrimeira) {
      pontosBase += 5; // Bônus por acertar na primeira tentativa
      descricao = "Cápsula concluída na primeira tentativa!";
    }

    await this.addPoints(userId, pontosBase, "capsula", capsulaId, descricao);

    // Verificar conquistas relacionadas a cápsulas
    await this.checkAndAwardBadges(userId);
  },

  /**
   * Adicionar pontos ao usuário
   */
  async addPoints(
    userId: string,
    pontos: number,
    origem: string,
    origemId?: string,
    descricao?: string
  ) {
    // Inserir no histórico de pontos
    await supabase
      .from("points_history")
      .insert({
        user_id: userId,
        pontos,
        origem,
        origem_id: origemId,
        descricao,
      });

    // Atualizar XP total do usuário
    const { data: stats } = await supabase
      .from("user_stats")
      .select("total_xp")
      .eq("user_id", userId)
      .single();

    const novoXP = (stats?.total_xp || 0) + pontos;

    await supabase
      .from("user_stats")
      .update({ total_xp: novoXP })
      .eq("user_id", userId);
  },

  /**
   * Verificar e conceder badge de streak
   */
  async checkStreakBadge(userId: string, days: number) {
    const action = days === 7 ? "streak_7_dias" : "streak_30_dias";
    
    // Adicionar pontos
    const { data: rule } = await supabase
      .from("gamification_rules")
      .select("pontos")
      .eq("acao", action)
      .eq("ativo", true)
      .single();

    if (rule) {
      await supabase
        .from("points_history")
        .insert({
          user_id: userId,
          pontos: rule.pontos,
          origem: "streak",
          descricao: `Streak de ${days} dias!`,
        });

      // Atualizar XP
      const { data: stats } = await supabase
        .from("user_stats")
        .select("total_xp")
        .eq("user_id", userId)
        .single();

      await supabase
        .from("user_stats")
        .update({ 
          total_xp: (stats?.total_xp || 0) + rule.pontos 
        })
        .eq("user_id", userId);
    }
  },

  /**
   * Obter regras de gamificação
   */
  async getGamificationRules() {
    const { data, error } = await supabase
      .from("gamification_rules")
      .select("*")
      .order("acao");

    if (error) throw error;
    return data || [];
  },

  /**
   * Atualizar regra de gamificação
   */
  async updateGamificationRule(id: string, updates: { pontos?: number; ativo?: boolean }) {
    const { error } = await supabase
      .from("gamification_rules")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
  },
};