import { supabase } from "@/integrations/supabase/client";

export type VirtualLabType = "ultrasound" | "mri" | "thermal" | "electrotherapy" | "other";

export interface VirtualLab {
  id?: string;
  name: string;
  title: string;
  description?: string;
  lab_type: VirtualLabType;
  config_data: any;
  thumbnail_url?: string;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const virtualLabService = {
  getAll: async (): Promise<VirtualLab[]> => {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as VirtualLab[];
  },

  getAllLabs: async (): Promise<VirtualLab[]> => {
    return virtualLabService.getAll();
  },

  getById: async (id: string): Promise<VirtualLab | null> => {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as VirtualLab;
  },

  getLabById: async (id: string): Promise<VirtualLab | null> => {
    return virtualLabService.getById(id);
  },

  create: async (lab: Omit<VirtualLab, "id" | "created_at" | "updated_at">): Promise<VirtualLab> => {
    const { data, error } = await supabase
      .from("virtual_labs")
      .insert(lab)
      .select()
      .single();

    if (error) throw error;
    return data as VirtualLab;
  },

  createLab: async (lab: Omit<VirtualLab, "id" | "created_at" | "updated_at">): Promise<VirtualLab> => {
    return virtualLabService.create(lab);
  },

  update: async (id: string, lab: Partial<VirtualLab>): Promise<VirtualLab> => {
    const { data, error } = await supabase
      .from("virtual_labs")
      .update(lab)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as VirtualLab;
  },

  updateLab: async (id: string, lab: Partial<VirtualLab>): Promise<VirtualLab> => {
    return virtualLabService.update(id, lab);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("virtual_labs")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  deleteLab: async (id: string): Promise<void> => {
    return virtualLabService.delete(id);
  },

  getLabUsageCount: async (labId: string): Promise<number> => {
    // Count how many lessons reference this lab
    const { count, error } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .contains("content_data", { blocks: [{ type: "lab", data: { labId } }] });

    if (error) {
      console.error("Error counting lab usage:", error);
      return 0;
    }
    return count || 0;
  }
};
