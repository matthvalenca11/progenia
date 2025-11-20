import { supabase } from "@/integrations/supabase/client";

export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon_name: string;
  requirement_type: "lessons_completed" | "modules_completed" | "streak_days" | "quiz_perfect" | "total_time";
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
    // Get user stats
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!stats) return [];

    // Get all badges
    const badges = await this.getAllBadges();

    // Get already earned badges
    const userBadges = await this.getUserBadges(userId);
    const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));

    // Check which badges should be awarded
    const newBadges: Badge[] = [];

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let shouldAward = false;

      switch (badge.requirement_type) {
        case "lessons_completed":
          shouldAward = stats.total_lessons_completed >= badge.requirement_value;
          break;
        case "modules_completed":
          // Count completed modules
          const { count } = await supabase
            .from("module_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
          shouldAward = (count || 0) >= badge.requirement_value;
          break;
        case "streak_days":
          shouldAward = stats.streak_days >= badge.requirement_value;
          break;
        case "quiz_perfect":
          // Check if user has any perfect quiz attempts
          const { data: attempts } = await supabase
            .from("quiz_attempts")
            .select("score, total_questions")
            .eq("user_id", userId);
          shouldAward = (attempts || []).some((a) => a.score === a.total_questions);
          break;
        case "total_time":
          shouldAward = stats.total_time_spent >= badge.requirement_value;
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

    // Award points to user_stats
    const { data: badge } = await supabase
      .from("badges")
      .select("points")
      .eq("id", badgeId)
      .single();

    if (badge?.points) {
      const { data: stats } = await supabase
        .from("user_stats")
        .select("total_points")
        .eq("user_id", userId)
        .single();

      if (stats) {
        await supabase
          .from("user_stats")
          .update({ total_points: (stats.total_points || 0) + badge.points })
          .eq("user_id", userId);
      }
    }
  },
};
