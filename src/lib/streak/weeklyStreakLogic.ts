/** Rolling 7-day weekly streak: at least one capsule per 7-day window. */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export const SIX_DAYS_MS = 6 * DAY_MS;
export const SIX_DAYS_21H_MS = 6 * DAY_MS + 21 * HOUR_MS;

export type WeeklyStreakDbFields = {
  weekly_streak_weeks: number | null;
  last_capsule_activity_at: string | null;
  weekly_streak_started_at: string | null;
};

export type WeeklyStreakSnapshot = {
  weeks: number;
  lastCapsuleAt: number | null;
  streakStartedAt: number | null;
  deadlineAt: number | null;
  msUntilDeadline: number;
  daysRemaining: number;
  hoursRemaining: number;
  isExpired: boolean;
  isAtRisk: boolean;
  isUrgent: boolean;
  completedThisWeek: boolean;
};

export function parseTs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function computeWeeklyStreakSnapshot(
  fields: WeeklyStreakDbFields,
  nowMs = Date.now(),
): WeeklyStreakSnapshot {
  const lastCapsuleAt = parseTs(fields.last_capsule_activity_at);
  const streakStartedAt = parseTs(fields.weekly_streak_started_at);
  const weeks = fields.weekly_streak_weeks ?? 0;

  if (!lastCapsuleAt || weeks <= 0) {
    return {
      weeks: 0,
      lastCapsuleAt: null,
      streakStartedAt: null,
      deadlineAt: null,
      msUntilDeadline: 0,
      daysRemaining: 0,
      hoursRemaining: 0,
      isExpired: false,
      isAtRisk: false,
      isUrgent: false,
      completedThisWeek: false,
    };
  }

  const deadlineAt = lastCapsuleAt + WEEK_MS;
  const msUntilDeadline = deadlineAt - nowMs;
  const isExpired = msUntilDeadline <= 0;
  const msSinceLast = nowMs - lastCapsuleAt;

  const daysRemaining = isExpired ? 0 : Math.max(0, Math.ceil(msUntilDeadline / DAY_MS));
  const hoursRemaining = isExpired ? 0 : Math.max(0, Math.ceil(msUntilDeadline / HOUR_MS));

  return {
    weeks: isExpired ? 0 : weeks,
    lastCapsuleAt,
    streakStartedAt,
    deadlineAt,
    msUntilDeadline,
    daysRemaining,
    hoursRemaining,
    isExpired,
    isAtRisk: !isExpired && msSinceLast >= SIX_DAYS_MS,
    isUrgent: !isExpired && msSinceLast >= SIX_DAYS_21H_MS,
    completedThisWeek: msSinceLast < WEEK_MS,
  };
}

/** Returns DB fields to persist after a capsule completion. */
export function applyCapsuleCompletion(
  fields: WeeklyStreakDbFields,
  nowMs = Date.now(),
): WeeklyStreakDbFields {
  const last = parseTs(fields.last_capsule_activity_at);
  const anchor = parseTs(fields.weekly_streak_started_at);
  const prevWeeks = fields.weekly_streak_weeks ?? 0;
  const nowIso = new Date(nowMs).toISOString();

  if (!last || !anchor || prevWeeks <= 0) {
    return {
      weekly_streak_weeks: 1,
      last_capsule_activity_at: nowIso,
      weekly_streak_started_at: nowIso,
    };
  }

  const msSinceLast = nowMs - last;
  if (msSinceLast > WEEK_MS) {
    return {
      weekly_streak_weeks: 1,
      last_capsule_activity_at: nowIso,
      weekly_streak_started_at: nowIso,
    };
  }

  const newWeeks = Math.max(1, Math.floor((nowMs - anchor) / WEEK_MS) + 1);

  return {
    weekly_streak_weeks: newWeeks,
    last_capsule_activity_at: nowIso,
    weekly_streak_started_at: fields.weekly_streak_started_at,
  };
}

/** If the 7-day window elapsed without activity, reset streak in DB. */
export function applyExpiryCheck(
  fields: WeeklyStreakDbFields,
  nowMs = Date.now(),
): WeeklyStreakDbFields | null {
  const last = parseTs(fields.last_capsule_activity_at);
  const weeks = fields.weekly_streak_weeks ?? 0;
  if (!last || weeks <= 0) return null;

  if (nowMs - last > WEEK_MS) {
    return {
      weekly_streak_weeks: 0,
      last_capsule_activity_at: fields.last_capsule_activity_at,
      weekly_streak_started_at: null,
    };
  }

  return null;
}
