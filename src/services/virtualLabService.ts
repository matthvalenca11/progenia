import { supabase } from "@/integrations/supabase/client";

export type VirtualLabType = "ultrasound" | "tens" | "mri" | "thermal" | "electrotherapy" | "other";

export interface VirtualLab {
  id?: string;
  name: string;
  slug: string;
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

  getBySlug: async (slug: string): Promise<VirtualLab | null> => {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error getting lab by slug:", error);
      return null;
    }
    return data as VirtualLab;
  },

  getPublishedLabs: async (): Promise<VirtualLab[]> => {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as VirtualLab[];
  },

  getLabUsageCount: async (labId: string): Promise<number> => {
    // Simplified count - check if lab is referenced in capsulas content_data
    try {
      const { data, error } = await supabase
        .from("capsulas")
        .select("content_data")
        .eq("is_published", true);

      if (error) {
        console.error("Error counting lab usage:", error);
        return 0;
      }

      let count = 0;
      (data || []).forEach((capsula: any) => {
        const contentData = capsula.content_data;
        if (contentData?.virtualLabId === labId) {
          count++;
        }
      });

      return count;
    } catch (error) {
      console.error("Error counting lab usage:", error);
      return 0;
    }
  },

  generateSlug: (title: string): string => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  },
};
