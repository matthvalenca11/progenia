import { supabase } from "@/integrations/supabase/client";

export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon_name: string;
  requirement_type:
    | "lessons_completed"
    | "modules_completed"
    | "streak_days"
    | "quiz_perfect"
    | "total_time"
    | "capsules_completed";
  requirement_value: number;
  points: number;
  created_at?: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
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

async function countCompletedModules(userId: string): Promise<number> {
  const { data: enrollments } = await supabase
    .from("module_enrollments")
    .select("module_id")
    .eq("user_id", userId);

  if (!enrollments?.length) return 0;

  let completed = 0;
  for (const { module_id: moduleId } of enrollments) {
    const [{ data: lessons }, { data: capsules }] = await Promise.all([
      supabase.from("lessons").select("id").eq("module_id", moduleId).eq("is_published", true),
      supabase.from("capsulas").select("id").eq("module_id", moduleId).eq("is_published", true),
    ]);

    const lessonIds = (lessons || []).map((l) => l.id);
    const capsuleIds = (capsules || []).map((c) => c.id);
    const total = lessonIds.length + capsuleIds.length;
    if (total === 0) continue;

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

    if ((doneLessons || 0) + (doneCapsules || 0) >= total) completed += 1;
  }
  return completed;
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
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("score, total_questions")
      .eq("user_id", userId);
    return (attempts || []).filter((a) => a.score === a.total_questions).length;
  }
}

export const badgeService = {
  async getAllBadges(): Promise<Badge[]> {
    const { data, error } = await supabase
      .from("badges")
      .select("*")
      .order("requirement_value", { ascending: true });

    if (error) throw error;
    return (data || []) as Badge[];
  },

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    const { data, error } = await supabase
      .from("user_badges")
      .select("*, badge:badges(*)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    if (error) throw error;
    return data as UserBadge[];
  },

  async checkAndAwardBadges(userId: string): Promise<Badge[]> {
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!stats) return [];

    const [badges, userBadges, lessonsCompleted, capsulesCompleted, modulesCompleted, perfectQuizzes] =
      await Promise.all([
        this.getAllBadges(),
        this.getUserBadges(userId),
        countCompletedLessons(userId),
        countCompletedCapsules(userId),
        countCompletedModules(userId),
        countPerfectQuizzes(userId),
      ]);

    const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));
    const newBadges: Badge[] = [];

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let shouldAward = false;

      switch (badge.requirement_type) {
        case "lessons_completed":
          shouldAward = lessonsCompleted >= badge.requirement_value;
          break;
        case "capsules_completed":
          shouldAward = capsulesCompleted >= badge.requirement_value;
          break;
        case "modules_completed":
          shouldAward = modulesCompleted >= badge.requirement_value;
          break;
        case "streak_days":
          shouldAward = (stats.streak_days || 0) >= badge.requirement_value;
          break;
        case "quiz_perfect":
          shouldAward = perfectQuizzes >= badge.requirement_value;
          break;
        case "total_time":
          shouldAward = (stats.total_time_spent || 0) >= badge.requirement_value;
          break;
      }

      if (shouldAward) {
        await this.awardBadge(userId, badge.id);
        newBadges.push(badge);
      }
    }

    return newBadges;
  },

  async awardBadge(userId: string, badgeId: string): Promise<void> {
    const { error } = await supabase
      .from("user_badges")
      .insert({ user_id: userId, badge_id: badgeId });

    if (error && !error.message.includes("duplicate")) throw error;

    const { data: badge } = await supabase
      .from("badges")
      .select("points, name")
      .eq("id", badgeId)
      .single();

    if (badge?.points) {
      const { data: stats } = await supabase
        .from("user_stats")
        .select("total_points")
        .eq("user_id", userId)
        .single();

      if (stats) {
        const newTotal = (stats.total_points || 0) + badge.points;
        await supabase
          .from("user_stats")
          .update({
            total_points: newTotal,
            level: Math.floor(Math.sqrt(Math.max(0, newTotal) / 100)),
          })
          .eq("user_id", userId);
      }

      try {
        await supabase.from("points_history").insert({
          user_id: userId,
          pontos: badge.points,
          origem: "badge",
          origem_id: badgeId,
          descricao: `Badge: ${badge.name}`,
        });
      } catch {
        // histórico opcional
      }
    }
  },
};
