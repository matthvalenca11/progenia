import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeMobile } from "@/lib/capacitor";
import { SIX_DAYS_21H_MS, SIX_DAYS_MS, type WeeklyStreakSnapshot } from "@/lib/streak/weeklyStreakLogic";

const CHANNEL_ID = "progenia_weekly_streak";

export const STREAK_NOTIFICATION_IDS = {
  MID_WEEK: 9101,
  WARN_ONE_DAY: 9102,
  WARN_THREE_HOURS: 9103,
} as const;

const ALL_IDS = Object.values(STREAK_NOTIFICATION_IDS);

type Lang = "pt" | "en";

function texts(lang: Lang, weeks: number) {
  const weekLabel =
    lang === "en"
      ? weeks === 1
        ? "1 week"
        : `${weeks} weeks`
      : weeks === 1
        ? "1 semana"
        : `${weeks} semanas`;

  return {
    midWeekTitle: lang === "en" ? "Keep your streak alive" : "Mantenha sua ofensiva",
    midWeekBody:
      lang === "en"
        ? `You're on a ${weekLabel} streak. Complete a capsule this week to keep it going.`
        : `Você está com ${weekLabel} de ofensiva. Complete uma cápsula nesta semana para mantê-la.`,
    warnDayTitle: lang === "en" ? "1 day left on your streak" : "Falta 1 dia na sua ofensiva",
    warnDayBody:
      lang === "en"
        ? `Complete at least one capsule in the next 24 hours to keep your ${weekLabel} streak.`
        : `Complete pelo menos uma cápsula nas próximas 24 horas para manter sua ofensiva de ${weekLabel}.`,
    urgentTitle: lang === "en" ? "Only 3 hours left!" : "Só 3 horas restantes!",
    urgentBody:
      lang === "en"
        ? `Your ${weekLabel} streak ends soon. Open ProGenia and finish a capsule now.`
        : `Sua ofensiva de ${weekLabel} termina em breve. Abra o ProGenia e conclua uma cápsula agora.`,
  };
}

async function ensureAndroidChannel() {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Weekly streak",
      description: "Reminders to maintain your learning streak",
      importance: 4,
      visibility: 1,
    });
  } catch {
    // iOS ignores channels
  }
}

export async function requestStreakNotificationPermission(): Promise<boolean> {
  if (!isNativeMobile) return false;
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

export async function cancelWeeklyStreakNotifications() {
  if (!isNativeMobile) return;
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS.map((id) => ({ id })) });
  } catch {
    // ignore
  }
}

export async function scheduleWeeklyStreakNotifications(
  snapshot: WeeklyStreakSnapshot,
  lang: Lang = "pt",
) {
  if (!isNativeMobile) return;
  if (!snapshot.lastCapsuleAt || snapshot.weeks <= 0 || snapshot.isExpired) {
    await cancelWeeklyStreakNotifications();
    return;
  }

  const granted = await requestStreakNotificationPermission();
  if (!granted) return;

  await ensureAndroidChannel();
  await cancelWeeklyStreakNotifications();

  const last = snapshot.lastCapsuleAt;
  const t = texts(lang, snapshot.weeks);
  const now = Date.now();

  const midWeekAt = last + 3 * 24 * 60 * 60 * 1000;
  const warnDayAt = last + SIX_DAYS_MS;
  const urgentAt = last + SIX_DAYS_21H_MS;

  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle?: boolean };
    channelId?: string;
  }> = [];

  if (midWeekAt > now) {
    notifications.push({
      id: STREAK_NOTIFICATION_IDS.MID_WEEK,
      title: t.midWeekTitle,
      body: t.midWeekBody,
      schedule: { at: new Date(midWeekAt), allowWhileIdle: true },
      channelId: CHANNEL_ID,
    });
  }

  if (warnDayAt > now) {
    notifications.push({
      id: STREAK_NOTIFICATION_IDS.WARN_ONE_DAY,
      title: t.warnDayTitle,
      body: t.warnDayBody,
      schedule: { at: new Date(warnDayAt), allowWhileIdle: true },
      channelId: CHANNEL_ID,
    });
  }

  if (urgentAt > now) {
    notifications.push({
      id: STREAK_NOTIFICATION_IDS.WARN_THREE_HOURS,
      title: t.urgentTitle,
      body: t.urgentBody,
      schedule: { at: new Date(urgentAt), allowWhileIdle: true },
      channelId: CHANNEL_ID,
    });
  }

  if (notifications.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications });
  } catch (error) {
    console.warn("[streakNotifications] schedule failed:", error);
  }
}

export function registerStreakNotificationListeners(onOpenApp: () => void) {
  if (!isNativeMobile) return () => {};

  const action = LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    if (ALL_IDS.includes(event.notification.id)) {
      onOpenApp();
    }
  });

  return () => {
    void action.then((h) => h.remove());
  };
}
