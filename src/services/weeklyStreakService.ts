import { supabase } from "@/integrations/supabase/client";
import {
  applyCapsuleCompletion,
  applyExpiryCheck,
  computeWeeklyStreakSnapshot,
  type WeeklyStreakDbFields,
  type WeeklyStreakSnapshot,
} from "@/lib/streak/weeklyStreakLogic";
import {
  cancelWeeklyStreakNotifications,
  scheduleWeeklyStreakNotifications,
} from "@/lib/streak/streakNotifications";

async function fetchWeeklyStreakFields(userId: string): Promise<WeeklyStreakDbFields> {
  const { data, error } = await supabase
    .from("user_stats")
    .select("weekly_streak_weeks, last_capsule_activity_at, weekly_streak_started_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    weekly_streak_weeks: data?.weekly_streak_weeks ?? 0,
    last_capsule_activity_at: data?.last_capsule_activity_at ?? null,
    weekly_streak_started_at: data?.weekly_streak_started_at ?? null,
  };
}

async function persistWeeklyStreakFields(userId: string, fields: WeeklyStreakDbFields) {
  const { error } = await supabase
    .from("user_stats")
    .update({
      weekly_streak_weeks: fields.weekly_streak_weeks,
      last_capsule_activity_at: fields.last_capsule_activity_at,
      weekly_streak_started_at: fields.weekly_streak_started_at,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw error;
}

export const weeklyStreakService = {
  async getSnapshot(userId: string): Promise<WeeklyStreakSnapshot> {
    const fields = await fetchWeeklyStreakFields(userId);
    return computeWeeklyStreakSnapshot(fields);
  },

  /** On app open / dashboard: expire stale streaks and reschedule notifications. */
  async syncOnAppOpen(userId: string, language: "pt" | "en" = "pt"): Promise<WeeklyStreakSnapshot> {
    const fields = await fetchWeeklyStreakFields(userId);
    const expired = applyExpiryCheck(fields);

    if (expired) {
      await persistWeeklyStreakFields(userId, expired);
      await cancelWeeklyStreakNotifications();
      return computeWeeklyStreakSnapshot(expired);
    }

    const snapshot = computeWeeklyStreakSnapshot(fields);
    await scheduleWeeklyStreakNotifications(snapshot, language);
    return snapshot;
  },

  /** After a capsule is completed — updates weeks and reschedules reminders. */
  async recordCapsuleCompleted(userId: string, language: "pt" | "en" = "pt"): Promise<WeeklyStreakSnapshot> {
    const fields = await fetchWeeklyStreakFields(userId);
    const expired = applyExpiryCheck(fields);
    const base = expired ?? fields;
    const updated = applyCapsuleCompletion(base);
    await persistWeeklyStreakFields(userId, updated);
    const snapshot = computeWeeklyStreakSnapshot(updated);
    await scheduleWeeklyStreakNotifications(snapshot, language);
    return snapshot;
  },
};
