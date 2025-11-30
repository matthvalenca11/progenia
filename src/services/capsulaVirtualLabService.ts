import { supabase } from "@/integrations/supabase/client";

export interface CapsulaVirtualLab {
  id?: string;
  capsula_id: string;
  lab_id: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export const capsulaVirtualLabService = {
  getLabsByCapsulaId: async (capsulaId: string): Promise<CapsulaVirtualLab[]> => {
    const { data, error } = await supabase
      .from("capsula_virtual_labs")
      .select("*")
      .eq("capsula_id", capsulaId)
      .order("position");

    if (error) throw error;
    return (data || []) as CapsulaVirtualLab[];
  },

  addLabToCapsula: async (
    capsulaId: string,
    labId: string,
    position: number = 0
  ): Promise<CapsulaVirtualLab> => {
    const { data, error } = await supabase
      .from("capsula_virtual_labs")
      .insert({
        capsula_id: capsulaId,
        lab_id: labId,
        position,
      })
      .select()
      .single();

    if (error) throw error;
    return data as CapsulaVirtualLab;
  },

  removeLabFromCapsula: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("capsula_virtual_labs")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  updatePosition: async (id: string, position: number): Promise<void> => {
    const { error } = await supabase
      .from("capsula_virtual_labs")
      .update({ position })
      .eq("id", id);

    if (error) throw error;
  },

  reorderLabs: async (capsulaId: string, labIds: string[]): Promise<void> => {
    // Update positions for all labs in order
    const updates = labIds.map((labId, index) =>
      supabase
        .from("capsula_virtual_labs")
        .update({ position: index })
        .eq("capsula_id", capsulaId)
        .eq("lab_id", labId)
    );

    await Promise.all(updates);
  },
};
