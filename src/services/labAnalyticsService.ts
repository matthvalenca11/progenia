import { supabase } from "@/integrations/supabase/client";

export type LabEventType = "open" | "interaction" | "close" | "complete";

interface TrackLabEventParams {
  labId: string;
  eventType: LabEventType;
  sessionId: string;
  capsulaId?: string | null;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export const labAnalyticsService = {
  createSessionId() {
    return crypto.randomUUID();
  },

  async trackEvent({
    labId,
    eventType,
    sessionId,
    capsulaId = null,
    durationSeconds,
    metadata = {},
  }: TrackLabEventParams) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("lab_usage_events").insert({
        user_id: user.id,
        lab_id: labId,
        capsula_id: capsulaId,
        session_id: sessionId,
        event_type: eventType,
        duration_seconds: durationSeconds,
        metadata,
      });

      if (error) {
        console.warn("labAnalytics trackEvent warning:", error.message);
      }
    } catch (error) {
      console.warn("labAnalytics trackEvent error:", error);
    }
  },
};
