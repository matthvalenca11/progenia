import { describe, expect, it } from "vitest";
import {
  applyCapsuleCompletion,
  applyExpiryCheck,
  computeWeeklyStreakSnapshot,
  DAY_MS,
  WEEK_MS,
} from "@/lib/streak/weeklyStreakLogic";

const base = {
  weekly_streak_weeks: 2,
  last_capsule_activity_at: new Date(0).toISOString(),
  weekly_streak_started_at: new Date(0).toISOString(),
};

describe("weeklyStreakLogic", () => {
  it("starts streak on first capsule", () => {
    const now = Date.now();
    const result = applyCapsuleCompletion(
      { weekly_streak_weeks: 0, last_capsule_activity_at: null, weekly_streak_started_at: null },
      now,
    );
    expect(result.weekly_streak_weeks).toBe(1);
    expect(result.last_capsule_activity_at).toBeTruthy();
    expect(result.weekly_streak_started_at).toBeTruthy();
  });

  it("resets after 7 days without activity", () => {
    const now = WEEK_MS + 1000;
    const result = applyCapsuleCompletion(base, now);
    expect(result.weekly_streak_weeks).toBe(1);
    expect(result.weekly_streak_started_at).toBe(result.last_capsule_activity_at);
  });

  it("increments weeks within rolling windows", () => {
    const start = 1_000_000;
    const first = applyCapsuleCompletion(
      { weekly_streak_weeks: 0, last_capsule_activity_at: null, weekly_streak_started_at: null },
      start,
    );
    const mid = applyCapsuleCompletion(first, start + 6 * DAY_MS);
    expect(mid.weekly_streak_weeks).toBe(1);
    const second = applyCapsuleCompletion(mid, start + 8 * DAY_MS);
    expect(second.weekly_streak_weeks).toBe(2);
  });

  it("expires streak on app open after deadline", () => {
    const lastAt = 1_000_000;
    const expired = applyExpiryCheck(
      {
        weekly_streak_weeks: 2,
        last_capsule_activity_at: new Date(lastAt).toISOString(),
        weekly_streak_started_at: new Date(lastAt).toISOString(),
      },
      lastAt + WEEK_MS + 1,
    );
    expect(expired?.weekly_streak_weeks).toBe(0);
  });

  it("flags at-risk windows", () => {
    const last = Date.now() - 6 * DAY_MS - 1000;
    const snapshot = computeWeeklyStreakSnapshot({
      weekly_streak_weeks: 3,
      last_capsule_activity_at: new Date(last).toISOString(),
      weekly_streak_started_at: new Date(last - WEEK_MS).toISOString(),
    });
    expect(snapshot.isAtRisk).toBe(true);
    expect(snapshot.weeks).toBe(3);
  });
});
