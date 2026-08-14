const MEMORY_PREFIX = "progenia_tutor_nudge_v1:";
const SESSION_PREFIX = "progenia_tutor_nudge_session:";
const PENDING_KEY = "progenia_tutor_nudge_pending";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** At most about one idle suggestion per day. */
const SHOW_GAP_MS = 20 * HOUR;
/** Closing the bubble with X means "not now". */
const DISMISS_COOLDOWN_MS = 3 * DAY;
/** They already followed a suggestion. */
const ACCEPT_COOLDOWN_MS = 2 * DAY;
/** They were just talking to the tutor. */
const TUTOR_OPEN_COOLDOWN_MS = 2 * HOUR;
/** Do not keep offering the same content. */
const PATH_REPEAT_MS = 14 * DAY;

export const NUDGE_APPEAR_DELAY_MS = 10_000;
export const NUDGE_AUTO_HIDE_MS = 12_000;

export type TutorNudgePayload = {
  title: string;
  path: string;
  kind?: string;
  reason?: string;
  prompt?: string;
};

type NudgeMemory = {
  lastShownAt: number;
  lastDismissedAt: number;
  lastAcceptedAt: number;
  lastTutorOpenAt: number;
  shownPaths: Record<string, number>;
};

const emptyMemory = (): NudgeMemory => ({
  lastShownAt: 0,
  lastDismissedAt: 0,
  lastAcceptedAt: 0,
  lastTutorOpenAt: 0,
  shownPaths: {},
});

const storageKey = (userId: string) => `${MEMORY_PREFIX}${userId}`;
const sessionKey = (userId: string) => `${SESSION_PREFIX}${userId}`;

function readMemory(userId: string): NudgeMemory {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<NudgeMemory>;
    return {
      ...emptyMemory(),
      ...parsed,
      shownPaths: parsed.shownPaths && typeof parsed.shownPaths === "object" ? parsed.shownPaths : {},
    };
  } catch {
    return emptyMemory();
  }
}

function writeMemory(userId: string, memory: NudgeMemory) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(memory));
  } catch {
    // Ignore quota / private mode.
  }
}

function sessionShown(userId: string) {
  try {
    return sessionStorage.getItem(sessionKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markSessionShown(userId: string) {
  try {
    sessionStorage.setItem(sessionKey(userId), "1");
  } catch {
    // Ignore.
  }
}

export function isCalmNudgeRoute(pathname: string) {
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/lesson/")) return false;
  if (pathname.startsWith("/capsula/")) return false;
  if (pathname.startsWith("/labs/")) return false;
  if (pathname.startsWith("/charts/")) return false;
  return (
    pathname === "/dashboard" ||
    pathname === "/capsulas" ||
    /^\/module\/[^/]+$/.test(pathname) ||
    /^\/module\/[^/]+\/capsulas$/.test(pathname)
  );
}

export function hasPendingCompletionNudge() {
  try {
    return sessionStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function consumePendingCompletionNudge() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore.
  }
}

export function markTutorNudgeAfterComplete() {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    // Ignore.
  }
}

export function markTutorOpenedForNudge(userId: string) {
  const memory = readMemory(userId);
  memory.lastTutorOpenAt = Date.now();
  writeMemory(userId, memory);
}

export function shouldAttemptNudge(userId: string, currentPath: string) {
  if (!userId) return false;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
  if (!isCalmNudgeRoute(currentPath)) return false;
  if (sessionShown(userId)) return false;

  const now = Date.now();
  const memory = readMemory(userId);
  if (memory.lastDismissedAt && now - memory.lastDismissedAt < DISMISS_COOLDOWN_MS) return false;
  if (memory.lastAcceptedAt && now - memory.lastAcceptedAt < ACCEPT_COOLDOWN_MS) return false;
  if (memory.lastTutorOpenAt && now - memory.lastTutorOpenAt < TUTOR_OPEN_COOLDOWN_MS) return false;
  if (!hasPendingCompletionNudge() && memory.lastShownAt && now - memory.lastShownAt < SHOW_GAP_MS) {
    return false;
  }
  return true;
}

export function canOfferNudge(userId: string, suggestionPath: string, currentPath: string) {
  if (!shouldAttemptNudge(userId, currentPath)) return false;
  if (!suggestionPath) return false;
  if (normalizeComparePath(currentPath) === normalizeComparePath(suggestionPath)) return false;

  const lastSamePath = readMemory(userId).shownPaths[suggestionPath] || 0;
  if (lastSamePath && Date.now() - lastSamePath < PATH_REPEAT_MS) return false;

  return true;
}

export function rememberNudgeShown(userId: string, path: string) {
  const memory = readMemory(userId);
  memory.lastShownAt = Date.now();
  memory.shownPaths[path] = Date.now();
  writeMemory(userId, memory);
  markSessionShown(userId);
  consumePendingCompletionNudge();
}

export function rememberNudgeDismissed(userId: string) {
  const memory = readMemory(userId);
  memory.lastDismissedAt = Date.now();
  writeMemory(userId, memory);
  consumePendingCompletionNudge();
}

export function rememberNudgeAccepted(userId: string, path: string) {
  const memory = readMemory(userId);
  memory.lastAcceptedAt = Date.now();
  memory.shownPaths[path] = Date.now();
  writeMemory(userId, memory);
  markSessionShown(userId);
  consumePendingCompletionNudge();
}

function normalizeComparePath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

export function nudgeKindLabel(kind: string | undefined, english: boolean) {
  if (kind === "lab") return english ? "Lab" : "Lab";
  if (kind === "capsula") return english ? "Capsule" : "Cápsula";
  if (kind === "module") return english ? "Module" : "Módulo";
  return english ? "Lesson" : "Aula";
}
