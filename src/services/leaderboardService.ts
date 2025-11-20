import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  total_points: number;
  total_lessons_completed: number;
  streak_days: number;
  rank: number;
}

export const leaderboardService = {
  async getTopUsers(limit: number = 10): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from("user_stats")
      .select("user_id, total_points, total_lessons_completed, streak_days, profiles(full_name, avatar_url)")
      .order("total_points", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((entry: any, index: number) => ({
      user_id: entry.user_id,
      full_name: entry.profiles?.full_name || "Usuário",
      avatar_url: entry.profiles?.avatar_url,
      total_points: entry.total_points || 0,
      total_lessons_completed: entry.total_lessons_completed || 0,
      streak_days: entry.streak_days || 0,
      rank: index + 1,
    }));
  },

  async getUserRank(userId: string): Promise<{ rank: number; total: number }> {
    // Get all users ordered by points
    const { data, error } = await supabase
      .from("user_stats")
      .select("user_id, total_points")
      .order("total_points", { ascending: false });

    if (error) throw error;

    const userIndex = (data || []).findIndex((u) => u.user_id === userId);
    return {
      rank: userIndex === -1 ? 0 : userIndex + 1,
      total: data?.length || 0,
    };
  },
};
