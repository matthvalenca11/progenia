import { supabase } from "@/integrations/supabase/client";
import { badgeService, type Badge } from "./badgeService";

/** Pontos padrão (fallback se gamification_rules não existir no banco) */
const DEFAULT_POINTS: Record<string, number> = {
  completar_aula: 10,
  completar_capsula: 15,
  completar_modulo: 50,
  quiz_perfeito: 25,
  streak_3_dias: 15,
  streak_7_dias: 30,
  streak_30_dias: 150,
};

export interface UserGamificationStats {
  total_points: number;
  total_xp: number;
  total_lessons_completed: number;
  capsules_completed: number;
  modules_completed: number;
  total_time_spent: number;
  total_time_minutes: number;
  streak_days: number;
  level: number;
}

export interface GamificationEventResult {
  pointsEarned: number;
  newBadges: Badge[];
  messages: string[];
}

export interface ProfileBadge {
  id: string;
  earned_at: string;
  badges: {
    name: string;
    description?: string;
    icon_name: string;
  };
}

export interface PointsHistoryEntry {
  id: string;
  pontos: number;
  descricao: string;
  origem: string;
  created_at: string;
}

function calculateLevel(totalPoints: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalPoints) / 100));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function getPointValue(acao: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("gamification_rules")
      .select("pontos, ativo")
      .eq("acao", acao)
      .maybeSingle();
    if (data?.ativo !== false && typeof data?.pontos === "number") {
      return data.pontos;
    }
  } catch {
    // tabela pode não existir em alguns ambientes
  }
  return DEFAULT_POINTS[acao] ?? 0;
}

async function ensureUserStats(userId: string) {
  const { data } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await supabase
    .from("user_stats")
    .insert({
      user_id: userId,
      total_lessons_completed: 0,
      total_time_spent: 0,
      streak_days: 0,
      total_points: 0,
      level: 0,
      last_activity_date: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return created;
}

async function countCompletedLessons(userId: string): Promise<number> {
  const { count } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "concluido");
  return count || 0;
}

async function countCompletedCapsules(userId: string): Promise<number> {
  const { count } = await supabase
    .from("capsula_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "concluido");
  return count || 0;
}

async function countPerfectQuizzes(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from("points_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("origem", "quiz_perfeito");
    return count || 0;
  } catch {
    return 0;
  }
}

async function countCompletedModules(userId: string): Promise<number> {
  const { data: enrollments } = await supabase
    .from("module_enrollments")
    .select("module_id")
    .eq("user_id", userId);

  if (!enrollments?.length) return 0;

  const moduleIds = enrollments.map((e) => e.module_id);
  let completed = 0;

  for (const moduleId of moduleIds) {
    const [{ data: lessons }, { data: capsules }] = await Promise.all([
      supabase.from("lessons").select("id").eq("module_id", moduleId).eq("is_published", true),
      supabase.from("capsulas").select("id").eq("module_id", moduleId).eq("is_published", true),
    ]);

    const lessonIds = (lessons || []).map((l) => l.id);
    const capsuleIds = (capsules || []).map((c) => c.id);
    const totalContent = lessonIds.length + capsuleIds.length;
    if (totalContent === 0) continue;

    const [{ count: doneLessons }, { count: doneCapsules }] = await Promise.all([
      lessonIds.length
        ? supabase
            .from("lesson_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "concluido")
            .in("lesson_id", lessonIds)
        : Promise.resolve({ count: 0 }),
      capsuleIds.length
        ? supabase
            .from("capsula_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "concluido")
            .in("capsula_id", capsuleIds)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((doneLessons || 0) + (doneCapsules || 0) >= totalContent) {
      completed += 1;
    }
  }

  return completed;
}

async function computeStudyMinutes(userId: string): Promise<number> {
  const { data: lessonProgress } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("status", "concluido");

  const { data: capsulaProgress } = await supabase
    .from("capsula_progress")
    .select("capsula_id")
    .eq("user_id", userId)
    .eq("status", "concluido");

  let minutes = 0;

  const lessonIds = (lessonProgress || []).map((p) => p.lesson_id);
  if (lessonIds.length) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("duration_minutes")
      .in("id", lessonIds);
    minutes += (lessons || []).reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  }

  const capsulaIds = (capsulaProgress || []).map((p) => p.capsula_id);
  if (capsulaIds.length) {
    const { data: capsulas } = await supabase
      .from("capsulas")
      .select("duration_minutes")
      .in("id", capsulaIds);
    minutes += (capsulas || []).reduce((sum, c) => sum + (c.duration_minutes || 0), 0);
  }

  return minutes;
}

async function syncUserStats(userId: string): Promise<UserGamificationStats> {
  const stats = await ensureUserStats(userId);
  const [lessonsCompleted, capsulesCompleted, modulesCompleted, studyMinutes] = await Promise.all([
    countCompletedLessons(userId),
    countCompletedCapsules(userId),
    countCompletedModules(userId),
    computeStudyMinutes(userId),
  ]);

  const totalPoints = stats.total_points || 0;
  const level = calculateLevel(totalPoints);

  await supabase
    .from("user_stats")
    .update({
      total_lessons_completed: lessonsCompleted,
      total_time_spent: studyMinutes,
      level,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return {
    total_points: totalPoints,
    total_xp: totalPoints,
    total_lessons_completed: lessonsCompleted,
    capsules_completed: capsulesCompleted,
    modules_completed: modulesCompleted,
    total_time_spent: studyMinutes,
    total_time_minutes: studyMinutes,
    streak_days: stats.streak_days || 0,
    level,
  };
}

async function recordPointsHistory(
  userId: string,
  pontos: number,
  origem: string,
  descricao: string,
  origemId?: string,
): Promise<void> {
  if (pontos <= 0) return;
  try {
    await supabase.from("points_history").insert({
      user_id: userId,
      pontos,
      origem,
      origem_id: origemId || null,
      descricao,
    });
  } catch (error) {
    console.warn("points_history insert skipped:", error);
  }
}

async function addPoints(
  userId: string,
  pontos: number,
  origem: string,
  descricao: string,
  origemId?: string,
): Promise<number> {
  if (pontos <= 0) return 0;

  const stats = await ensureUserStats(userId);
  const newTotal = (stats.total_points || 0) + pontos;
  const level = calculateLevel(newTotal);

  await supabase
    .from("user_stats")
    .update({
      total_points: newTotal,
      level,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  await recordPointsHistory(userId, pontos, origem, descricao, origemId);
  return pontos;
}

async function updateActivityStreak(userId: string): Promise<{ streak: number; bonusPoints: number; messages: string[] }> {
  const stats = await ensureUserStats(userId);
  const today = todayIsoDate();
  const yesterday = yesterdayIsoDate();
  const last = stats.last_activity_date;

  let streak = stats.streak_days || 0;
  const messages: string[] = [];
  let bonusPoints = 0;

  if (last === today) {
    // já contou hoje
  } else if (last === yesterday) {
    streak += 1;
    messages.push(`${streak} dias seguidos estudando!`);
  } else {
    streak = 1;
  }

  await supabase
    .from("user_stats")
    .update({
      streak_days: streak,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (streak === 3) {
    bonusPoints += await getPointValue("streak_3_dias");
    if (bonusPoints) {
      await addPoints(userId, bonusPoints, "streak_3_dias", "Bônus: 3 dias seguidos");
      messages.push(`+${bonusPoints} XP por sequência de 3 dias`);
    }
  }
  if (streak === 7) {
    const pts = await getPointValue("streak_7_dias");
    if (pts) {
      await addPoints(userId, pts, "streak_7_dias", "Bônus: 7 dias seguidos");
      bonusPoints += pts;
      messages.push(`+${pts} XP por sequência de 7 dias`);
    }
  }
  if (streak === 30) {
    const pts = await getPointValue("streak_30_dias");
    if (pts) {
      await addPoints(userId, pts, "streak_30_dias", "Bônus: 30 dias seguidos");
      bonusPoints += pts;
      messages.push(`+${pts} XP por sequência de 30 dias`);
    }
  }

  return { streak, bonusPoints, messages };
}

async function isModuleNewlyComplete(userId: string, moduleId: string): Promise<boolean> {
  const [{ data: lessons }, { data: capsules }] = await Promise.all([
    supabase.from("lessons").select("id").eq("module_id", moduleId).eq("is_published", true),
    supabase.from("capsulas").select("id").eq("module_id", moduleId).eq("is_published", true),
  ]);

  const lessonIds = (lessons || []).map((l) => l.id);
  const capsuleIds = (capsules || []).map((c) => c.id);
  const total = lessonIds.length + capsuleIds.length;
  if (total === 0) return false;

  const [{ count: doneLessons }, { count: doneCapsules }] = await Promise.all([
    lessonIds.length
      ? supabase
          .from("lesson_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "concluido")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ count: 0 }),
    capsuleIds.length
      ? supabase
          .from("capsula_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "concluido")
          .in("capsula_id", capsuleIds)
      : Promise.resolve({ count: 0 }),
  ]);

  if ((doneLessons || 0) + (doneCapsules || 0) < total) return false;

  try {
    const { count } = await supabase
      .from("points_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("origem", "completar_modulo")
      .eq("origem_id", moduleId);
    return (count || 0) === 0;
  } catch {
    return true;
  }
}

async function finalizeActivity(
  userId: string,
  moduleId?: string | null,
): Promise<GamificationEventResult> {
  await syncUserStats(userId);
  const streakResult = await updateActivityStreak(userId);

  let pointsEarned = streakResult.bonusPoints;
  const messages = [...streakResult.messages];

  if (moduleId) {
    const newlyComplete = await isModuleNewlyComplete(userId, moduleId);
    if (newlyComplete) {
      const pts = await getPointValue("completar_modulo");
      if (pts) {
        await addPoints(userId, pts, "completar_modulo", "Módulo concluído", moduleId);
        pointsEarned += pts;
        messages.push(`+${pts} XP por concluir o módulo`);
      }
    }
  }

  const newBadges = await badgeService.checkAndAwardBadges(userId);
  for (const badge of newBadges) {
    messages.push(`Badge desbloqueado: ${badge.name}`);
  }

  return { pointsEarned, newBadges, messages };
}

export const gamificationService = {
  calculateLevel,

  async syncUserStats(userId: string) {
    return syncUserStats(userId);
  },

  async getUserStats(userId: string): Promise<UserGamificationStats> {
    return syncUserStats(userId);
  },

  async getUserBadges(userId: string): Promise<ProfileBadge[]> {
    const rows = await badgeService.getUserBadges(userId);
    return rows.map((row) => ({
      id: row.id,
      earned_at: row.earned_at,
      badges: {
        name: row.badge?.name || "Badge",
        description: row.badge?.description,
        icon_name: row.badge?.icon_name || "Award",
      },
    }));
  },

  async getAllBadgesWithProgress(userId: string) {
    const [allBadges, earned, stats] = await Promise.all([
      badgeService.getAllBadges(),
      badgeService.getUserBadges(userId),
      syncUserStats(userId),
    ]);
    const earnedIds = new Set(earned.map((e) => e.badge_id));
    const perfectQuizzes = await countPerfectQuizzes(userId);

    return allBadges.map((badge) => {
      const unlocked = earnedIds.has(badge.id);
      let current = 0;
      switch (badge.requirement_type) {
        case "lessons_completed":
          current = stats.total_lessons_completed;
          break;
        case "capsules_completed":
          current = stats.capsules_completed;
          break;
        case "modules_completed":
          current = stats.modules_completed;
          break;
        case "streak_days":
          current = stats.streak_days;
          break;
        case "total_time":
          current = stats.total_time_spent;
          break;
        case "quiz_perfect":
          current = perfectQuizzes;
          break;
      }
      return {
        ...badge,
        unlocked,
        current,
        target: badge.requirement_value,
        progress:
          badge.requirement_value > 0
            ? Math.min(100, Math.round((current / badge.requirement_value) * 100))
            : 100,
      };
    });
  },

  async getPointsHistory(userId: string): Promise<PointsHistoryEntry[]> {
    try {
      const { data, error } = await supabase
        .from("points_history")
        .select("id, pontos, descricao, origem, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as PointsHistoryEntry[];
    } catch {
      return [];
    }
  },

  async onLessonCompleted(userId: string, lessonId: string): Promise<GamificationEventResult> {
    try {
      const { count } = await supabase
        .from("points_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("origem", "completar_aula")
        .eq("origem_id", lessonId);
      if ((count || 0) > 0) {
        return { pointsEarned: 0, newBadges: [], messages: [] };
      }
    } catch {
      // segue se points_history não existir
    }

    const { data: lesson } = await supabase
      .from("lessons")
      .select("title, module_id")
      .eq("id", lessonId)
      .maybeSingle();

    const pts = await getPointValue("completar_aula");
    let pointsEarned = 0;
    const messages: string[] = [];

    if (pts) {
      pointsEarned = await addPoints(
        userId,
        pts,
        "completar_aula",
        `Aula concluída: ${lesson?.title || "Aula"}`,
        lessonId,
      );
      messages.push(`+${pointsEarned} XP`);
    }

    const result = await finalizeActivity(userId, lesson?.module_id || null);
    return {
      pointsEarned: pointsEarned + result.pointsEarned,
      newBadges: result.newBadges,
      messages: [...messages, ...result.messages],
    };
  },

  async onCapsuleCompleted(userId: string, capsulaId: string): Promise<GamificationEventResult> {
    try {
      const { count } = await supabase
        .from("points_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("origem", "completar_capsula")
        .eq("origem_id", capsulaId);
      if ((count || 0) > 0) {
        return { pointsEarned: 0, newBadges: [], messages: [] };
      }
    } catch {
      // segue
    }

    const { data: capsula } = await supabase
      .from("capsulas")
      .select("title, module_id")
      .eq("id", capsulaId)
      .maybeSingle();

    const pts = await getPointValue("completar_capsula");
    let pointsEarned = 0;
    const messages: string[] = [];

    if (pts) {
      pointsEarned = await addPoints(
        userId,
        pts,
        "completar_capsula",
        `Cápsula concluída: ${capsula?.title || "Cápsula"}`,
        capsulaId,
      );
      messages.push(`+${pointsEarned} XP`);
    }

    const result = await finalizeActivity(userId, capsula?.module_id || null);
    return {
      pointsEarned: pointsEarned + result.pointsEarned,
      newBadges: result.newBadges,
      messages: [...messages, ...result.messages],
    };
  },

  async backfillMissingPoints(userId: string): Promise<void> {
    const { data: lessonRows } = await supabase
      .from("lesson_progress")
      .select("lesson_id, lessons(title)")
      .eq("user_id", userId)
      .eq("status", "concluido");

    for (const row of lessonRows || []) {
      try {
        const { count } = await supabase
          .from("points_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("origem", "completar_aula")
          .eq("origem_id", row.lesson_id);
        if ((count || 0) > 0) continue;
      } catch {
        continue;
      }

      const lessonTitle = (row.lessons as { title?: string } | null)?.title || "Aula";
      const pts = await getPointValue("completar_aula");
      if (pts) {
        await addPoints(userId, pts, "completar_aula", `Aula concluída: ${lessonTitle}`, row.lesson_id);
      }
    }

    const { data: capsuleRows } = await supabase
      .from("capsula_progress")
      .select("capsula_id, capsulas(title)")
      .eq("user_id", userId)
      .eq("status", "concluido");

    for (const row of capsuleRows || []) {
      try {
        const { count } = await supabase
          .from("points_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("origem", "completar_capsula")
          .eq("origem_id", row.capsula_id);
        if ((count || 0) > 0) continue;
      } catch {
        continue;
      }

      const capsulaTitle = (row.capsulas as { title?: string } | null)?.title || "Cápsula";
      const pts = await getPointValue("completar_capsula");
      if (pts) {
        await addPoints(userId, pts, "completar_capsula", `Cápsula concluída: ${capsulaTitle}`, row.capsula_id);
      }
    }

    await syncUserStats(userId);
    await badgeService.checkAndAwardBadges(userId);
  },

  async onCapsuleQuizPerfect(userId: string, capsulaId: string): Promise<GamificationEventResult> {
    try {
      const { count } = await supabase
        .from("points_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("origem", "quiz_perfeito")
        .eq("origem_id", capsulaId);
      if ((count || 0) > 0) {
        return { pointsEarned: 0, newBadges: [], messages: [] };
      }
    } catch {
      // segue
    }

    const pts = await getPointValue("quiz_perfeito");
    let pointsEarned = 0;
    const messages: string[] = [];

    if (pts) {
      pointsEarned = await addPoints(userId, pts, "quiz_perfeito", "Quiz perfeito na cápsula", capsulaId);
      messages.push(`+${pointsEarned} XP por quiz perfeito`);
    }

    const newBadges = await badgeService.checkAndAwardBadges(userId);
    for (const badge of newBadges) {
      messages.push(`Badge desbloqueado: ${badge.name}`);
    }

    return { pointsEarned, newBadges, messages };
  },
};
