import { supabase } from "@/integrations/supabase/client";
import { UltrasoundAnatomyPresetId } from "@/types/ultrasoundPresets";
import { UltrasoundLayerConfig, UltrasoundInclusionConfig } from "@/types/acousticMedia";
import { UltrasoundSimulationFeatures, ComplexityLevel } from "@/types/ultrasoundAdvanced";

export type VirtualLabType = "ultrasound" | "electrotherapy" | "thermal" | "other";

export type UltrasoundLabControls = {
  showGain: boolean;
  showDepth: boolean;
  showFrequency: boolean;
  showFocus: boolean;
};

export type UltrasoundLabConfig = {
  presetId: UltrasoundAnatomyPresetId;
  controls: UltrasoundLabControls;
  initialGain?: number;
  initialDepth?: number;
  initialFrequencyMHz?: number;
  initialFocusCm?: number;
  // Advanced physics configuration
  layers?: UltrasoundLayerConfig[];
  inclusions?: UltrasoundInclusionConfig[];
  // Simulation features
  simulationFeatures?: UltrasoundSimulationFeatures;
  complexityLevel?: ComplexityLevel;
};

export type VirtualLab = {
  id?: string;
  name?: string;
  description?: string;
  lab_type: VirtualLabType;
  lesson_id?: string | null;
  config_data: {
    ultrasoundConfig?: UltrasoundLabConfig;
    // Future: electrotherapyConfig, thermalConfig, etc.
  };
  created_at?: string;
  updated_at?: string;
};

export const virtualLabService = {
  /**
   * Get all virtual labs
   */
  async getAllLabs(): Promise<VirtualLab[]> {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as VirtualLab[];
  },

  /**
   * Get lab by ID
   */
  async getLabById(id: string): Promise<VirtualLab | null> {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as VirtualLab | null;
  },

  /**
   * Get labs by type
   */
  async getLabsByType(type: VirtualLabType): Promise<VirtualLab[]> {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .eq("lab_type", type)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as VirtualLab[];
  },

  /**
   * Create new virtual lab
   */
  async createLab(lab: Omit<VirtualLab, "id" | "created_at" | "updated_at">): Promise<string> {
    const { data, error } = await supabase
      .from("virtual_labs")
      .insert([lab])
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  },

  /**
   * Update virtual lab
   */
  async updateLab(id: string, lab: Partial<VirtualLab>): Promise<void> {
    const { error } = await supabase
      .from("virtual_labs")
      .update({
        ...lab,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Delete virtual lab
   */
  async deleteLab(id: string): Promise<void> {
    const { error } = await supabase
      .from("virtual_labs")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Get usage count for a lab (how many capsules use it)
   */
  async getLabUsageCount(labId: string): Promise<number> {
    const { count, error } = await supabase
      .from("capsulas")
      .select("*", { count: "exact", head: true })
      .eq("virtual_lab_id", labId);

    if (error) throw error;
    return count || 0;
  },
};
