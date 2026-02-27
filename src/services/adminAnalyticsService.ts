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

    const [
      kpisRes,
      signupsRes,
      demographicsRes,
      contentUsageRes,
      topContentRes,
      engagementRes,
      labsUsageRes,
    ] = await Promise.all([
      supabase.rpc("admin_dashboard_kpis", rpcParams),
      supabase.rpc("admin_dashboard_signups_series", rpcParams),
      supabase.rpc("admin_dashboard_demographics", {
        p_start: toIsoStart(filters.startDate),
        p_end: toIsoEnd(filters.endDate),
      }),
      supabase.rpc("admin_dashboard_content_usage", rpcParams),
      supabase.rpc("admin_dashboard_top_content", { ...rpcParams, p_limit: 12 }),
      supabase.rpc("admin_dashboard_engagement_series", rpcParams),
      supabase.rpc("admin_dashboard_lab_usage", { ...rpcParams, p_limit: 12 }),
    ]);

    const failures = [kpisRes, signupsRes, demographicsRes, contentUsageRes, topContentRes, engagementRes, labsUsageRes]
      .filter((result) => result.error)
      .map((result) => result.error?.message)
      .join(" | ");

    if (failures) {
      throw new Error(failures);
    }

    const kpiRow = (kpisRes.data?.[0] || {}) as Record<string, number>;

    return {
      kpis: {
        totalUsers: Number(kpiRow.total_users || 0),
        newUsers: Number(kpiRow.new_users || 0),
        activeUsers: Number(kpiRow.active_users || 0),
        lessonCompletions: Number(kpiRow.lesson_completions || 0),
        capsulaCompletions: Number(kpiRow.capsula_completions || 0),
        avgLessonProgress: Number(kpiRow.avg_lesson_progress || 0),
        totalLabSessions: Number(kpiRow.total_lab_sessions || 0),
        totalLabTimeSeconds: Number(kpiRow.total_lab_time_seconds || 0),
      },
      signupsSeries: (signupsRes.data || []) as SignupsPoint[],
      demographics: (demographicsRes.data || []) as DemographicPoint[],
      contentUsage: (contentUsageRes.data || []) as ContentUsagePoint[],
      topContent: (topContentRes.data || []) as TopContentPoint[],
      engagementSeries: (engagementRes.data || []) as EngagementPoint[],
      labsUsage: (labsUsageRes.data || []) as LabUsagePoint[],
    };
  },
};
