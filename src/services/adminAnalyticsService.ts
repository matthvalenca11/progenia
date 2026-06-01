import { supabase } from "@/integrations/supabase/client";

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  gender: string | null;
  stateUf: string | null;
  profession: string | null;
}

export interface DashboardKpis {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  lessonCompletions: number;
  capsulaCompletions: number;
  avgLessonProgress: number;
  totalLabSessions: number;
  totalLabTimeSeconds: number;
}

export interface SignupsPoint {
  period: string;
  signups: number;
}

export interface DemographicPoint {
  dimension: "gender" | "state_uf" | "education_level" | "profession";
  label: string;
  total: number;
}

export interface ContentUsagePoint {
  content_type: "lesson" | "capsula";
  status: string;
  total: number;
}

export interface TopContentPoint {
  content_type: "lesson" | "capsula";
  content_id: string;
  title: string;
  starts: number;
  completions: number;
  completion_rate: number;
}

export interface EngagementPoint {
  period: string;
  dau: number;
  lesson_completions: number;
  capsula_completions: number;
  quiz_attempts: number;
}

export interface LabUsagePoint {
  lab_id: string;
  lab_name: string;
  sessions: number;
  unique_users: number;
  total_time_seconds: number;
  avg_time_seconds: number;
  opens: number;
  interactions: number;
  completes: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  signupsSeries: SignupsPoint[];
  demographics: DemographicPoint[];
  contentUsage: ContentUsagePoint[];
  topContent: TopContentPoint[];
  engagementSeries: EngagementPoint[];
  labsUsage: LabUsagePoint[];
}

const toIsoStart = (dateStr: string) => `${dateStr}T00:00:00.000Z`;
const toIsoEnd = (dateStr: string) => `${dateStr}T23:59:59.999Z`;

function applyProfileFilters<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filters: DashboardFilters,
): T {
  let q = query;
  if (filters.gender) q = q.eq("gender", filters.gender);
  if (filters.stateUf) q = q.eq("state_uf", filters.stateUf);
  if (filters.profession) q = q.eq("profession", filters.profession);
  return q;
}

async function getFilteredUserIds(filters: DashboardFilters): Promise<Set<string>> {
  const { data, error } = await applyProfileFilters(
    supabase.from("profiles").select("id"),
    filters,
  );
  if (error) throw error;
  return new Set((data || []).map((row) => row.id));
}

async function computeKpisFromData(
  filters: DashboardFilters,
  allowedUsers: Set<string>,
): Promise<DashboardKpis> {
  const start = toIsoStart(filters.startDate);
  const end = toIsoEnd(filters.endDate);
  const userIds = Array.from(allowedUsers);

  if (userIds.length === 0) {
    return {
      totalUsers: 0,
      newUsers: 0,
      activeUsers: 0,
      lessonCompletions: 0,
      capsulaCompletions: 0,
      avgLessonProgress: 0,
      totalLabSessions: 0,
      totalLabTimeSeconds: 0,
    };
  }

  const [
    newUsersRes,
    lessonProgressRes,
    capsulaProgressRes,
    labEventsRes,
    userStatsRes,
  ] = await Promise.all([
    applyProfileFilters(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end),
      filters,
    ),
    supabase
      .from("lesson_progress")
      .select("user_id, status, progress_percentage, updated_at, data_conclusao")
      .in("user_id", userIds),
    supabase
      .from("capsula_progress")
      .select("user_id, status, progress_percentage, updated_at, data_conclusao")
      .in("user_id", userIds),
    supabase
      .from("lab_usage_events")
      .select("user_id, event_type, duration_seconds, created_at")
      .in("user_id", userIds)
      .gte("created_at", start)
      .lte("created_at", end),
    supabase
      .from("user_stats")
      .select("user_id, last_activity_date")
      .in("user_id", userIds)
      .gte("last_activity_date", filters.startDate)
      .lte("last_activity_date", filters.endDate),
  ]);

  const lessons = lessonProgressRes.data || [];
  const capsules = capsulaProgressRes.data || [];
  const labs = labEventsRes.data || [];

  const inRange = (iso: string | null | undefined) => {
    if (!iso) return false;
    return iso >= start && iso <= end;
  };

  const activeUsers = new Set<string>();
  lessons.forEach((row) => {
    if (inRange(row.updated_at)) activeUsers.add(row.user_id);
  });
  capsules.forEach((row) => {
    if (inRange(row.updated_at)) activeUsers.add(row.user_id);
  });
  labs.forEach((row) => activeUsers.add(row.user_id));
  (userStatsRes.data || []).forEach((row) => activeUsers.add(row.user_id));

  const lessonCompletions = lessons.filter(
    (row) =>
      row.status === "concluido" &&
      inRange(row.data_conclusao || row.updated_at),
  ).length;

  const capsulaCompletions = capsules.filter(
    (row) =>
      row.status === "concluido" &&
      inRange(row.data_conclusao || row.updated_at),
  ).length;

  const progressValues = [
    ...lessons.filter((row) => inRange(row.updated_at)).map((row) => row.progress_percentage || 0),
    ...capsules.filter((row) => inRange(row.updated_at)).map((row) => row.progress_percentage || 0),
  ];
  const avgLessonProgress =
    progressValues.length > 0
      ? progressValues.reduce((sum, val) => sum + val, 0) / progressValues.length
      : 0;

  const totalLabSessions = labs.filter((row) => row.event_type === "open").length;
  const totalLabTimeSeconds = labs
    .filter((row) => row.event_type === "close")
    .reduce((sum, row) => sum + (row.duration_seconds || 0), 0);

  return {
    totalUsers: userIds.length,
    newUsers: newUsersRes.count || 0,
    activeUsers: activeUsers.size,
    lessonCompletions,
    capsulaCompletions,
    avgLessonProgress,
    totalLabSessions,
    totalLabTimeSeconds,
  };
}

async function computeDemographics(): Promise<DemographicPoint[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("gender, state_uf, education_level, profession");

  if (error) throw error;

  const aggregate = (
    dimension: DemographicPoint["dimension"],
    pick: (row: (typeof data)[number]) => string | null | undefined,
  ) => {
    const counts = new Map<string, number>();
    (data || []).forEach((row) => {
      const label = pick(row)?.trim() || "Não informado";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, total]) => ({
      dimension,
      label,
      total,
    }));
  };

  return [
    ...aggregate("gender", (row) => row.gender),
    ...aggregate("state_uf", (row) => row.state_uf),
    ...aggregate("education_level", (row) => row.education_level),
    ...aggregate("profession", (row) => row.profession),
  ];
}

export const adminAnalyticsService = {
  async getFilterOptions() {
    const { data, error } = await supabase
      .from("profiles")
      .select("gender, state_uf, profession");

    if (error) throw error;

    const genders = Array.from(
      new Set((data || []).map((item) => item.gender).filter((v): v is string => !!v)),
    ).sort();
    const states = Array.from(
      new Set((data || []).map((item) => item.state_uf).filter((v): v is string => !!v)),
    ).sort();
    const professions = Array.from(
      new Set((data || []).map((item) => item.profession).filter((v): v is string => !!v)),
    ).sort();

    return { genders, states, professions };
  },

  async getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
    const rpcParams = {
      p_start: toIsoStart(filters.startDate),
      p_end: toIsoEnd(filters.endDate),
      p_gender: filters.gender,
      p_state_uf: filters.stateUf,
      p_profession: filters.profession,
    };

    const allowedUsers = await getFilteredUserIds(filters);
    const [computedKpis, computedDemographics] = await Promise.all([
      computeKpisFromData(filters, allowedUsers),
      computeDemographics(),
    ]);

    const [
      signupsRes,
      contentUsageRes,
      topContentRes,
      engagementRes,
      labsUsageRes,
    ] = await Promise.all([
      supabase.rpc("admin_dashboard_signups_series", rpcParams),
      supabase.rpc("admin_dashboard_content_usage", rpcParams),
      supabase.rpc("admin_dashboard_top_content", { ...rpcParams, p_limit: 12 }),
      supabase.rpc("admin_dashboard_engagement_series", rpcParams),
      supabase.rpc("admin_dashboard_lab_usage", { ...rpcParams, p_limit: 12 }),
    ]);

    const chartFailures = [signupsRes, contentUsageRes, topContentRes, engagementRes, labsUsageRes]
      .filter((result) => result.error)
      .map((result) => result.error?.message)
      .join(" | ");

    if (chartFailures) {
      console.warn("Dashboard charts fallback warning:", chartFailures);
    }

    return {
      kpis: computedKpis,
      signupsSeries: (signupsRes.data || []) as SignupsPoint[],
      demographics: computedDemographics,
      contentUsage: (contentUsageRes.data || []) as ContentUsagePoint[],
      topContent: (topContentRes.data || []) as TopContentPoint[],
      engagementSeries: (engagementRes.data || []) as EngagementPoint[],
      labsUsage: (labsUsageRes.data || []) as LabUsagePoint[],
    };
  },
};
