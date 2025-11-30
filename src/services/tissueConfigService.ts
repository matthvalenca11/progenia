import { supabase } from "@/integrations/supabase/client";
import { TissueConfig } from "@/types/tissueConfig";

export const tissueConfigService = {
  async getAll(): Promise<TissueConfig[]> {
    const { data, error } = await supabase
      .from("tissue_configs")
      .select("*")
      .order("name");

    if (error) throw error;

    return data.map(config => ({
      id: config.id,
      name: config.name,
      description: config.description || undefined,
      skinThickness: Number(config.skin_thickness),
      fatThickness: Number(config.fat_thickness),
      muscleThickness: Number(config.muscle_thickness),
      boneDepth: Number(config.bone_depth),
      hasMetalImplant: config.has_metal_implant,
      metalImplantDepth: config.metal_implant_depth ? Number(config.metal_implant_depth) : undefined,
      metalImplantSpan: config.metal_implant_span ? Number(config.metal_implant_span) : undefined,
      tissueType: config.tissue_type as TissueConfig["tissueType"],
      enableRiskSimulation: config.enable_risk_simulation,
      created_at: config.created_at || undefined,
      updated_at: config.updated_at || undefined,
    }));
  },

  async getById(id: string): Promise<TissueConfig | null> {
    const { data, error } = await supabase
      .from("tissue_configs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      skinThickness: Number(data.skin_thickness),
      fatThickness: Number(data.fat_thickness),
      muscleThickness: Number(data.muscle_thickness),
      boneDepth: Number(data.bone_depth),
      hasMetalImplant: data.has_metal_implant,
      metalImplantDepth: data.metal_implant_depth ? Number(data.metal_implant_depth) : undefined,
      metalImplantSpan: data.metal_implant_span ? Number(data.metal_implant_span) : undefined,
      tissueType: data.tissue_type as TissueConfig["tissueType"],
      enableRiskSimulation: data.enable_risk_simulation,
      created_at: data.created_at || undefined,
      updated_at: data.updated_at || undefined,
    };
  },

  async create(config: Omit<TissueConfig, "id" | "created_at" | "updated_at">): Promise<TissueConfig> {
    const { data, error } = await supabase
      .from("tissue_configs")
      .insert({
        name: config.name,
        description: config.description,
        skin_thickness: config.skinThickness,
        fat_thickness: config.fatThickness,
        muscle_thickness: config.muscleThickness,
        bone_depth: config.boneDepth,
        has_metal_implant: config.hasMetalImplant,
        metal_implant_depth: config.metalImplantDepth,
        metal_implant_span: config.metalImplantSpan,
        tissue_type: config.tissueType,
        enable_risk_simulation: config.enableRiskSimulation,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      skinThickness: Number(data.skin_thickness),
      fatThickness: Number(data.fat_thickness),
      muscleThickness: Number(data.muscle_thickness),
      boneDepth: Number(data.bone_depth),
      hasMetalImplant: data.has_metal_implant,
      metalImplantDepth: data.metal_implant_depth ? Number(data.metal_implant_depth) : undefined,
      metalImplantSpan: data.metal_implant_span ? Number(data.metal_implant_span) : undefined,
      tissueType: data.tissue_type as TissueConfig["tissueType"],
      enableRiskSimulation: data.enable_risk_simulation,
      created_at: data.created_at || undefined,
      updated_at: data.updated_at || undefined,
    };
  },

  async update(id: string, config: Partial<Omit<TissueConfig, "id" | "created_at" | "updated_at">>): Promise<TissueConfig> {
    const updateData: any = {};
    
    if (config.name !== undefined) updateData.name = config.name;
    if (config.description !== undefined) updateData.description = config.description;
    if (config.skinThickness !== undefined) updateData.skin_thickness = config.skinThickness;
    if (config.fatThickness !== undefined) updateData.fat_thickness = config.fatThickness;
    if (config.muscleThickness !== undefined) updateData.muscle_thickness = config.muscleThickness;
    if (config.boneDepth !== undefined) updateData.bone_depth = config.boneDepth;
    if (config.hasMetalImplant !== undefined) updateData.has_metal_implant = config.hasMetalImplant;
    if (config.metalImplantDepth !== undefined) updateData.metal_implant_depth = config.metalImplantDepth;
    if (config.metalImplantSpan !== undefined) updateData.metal_implant_span = config.metalImplantSpan;
    if (config.tissueType !== undefined) updateData.tissue_type = config.tissueType;
    if (config.enableRiskSimulation !== undefined) updateData.enable_risk_simulation = config.enableRiskSimulation;

    const { data, error } = await supabase
      .from("tissue_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      skinThickness: Number(data.skin_thickness),
      fatThickness: Number(data.fat_thickness),
      muscleThickness: Number(data.muscle_thickness),
      boneDepth: Number(data.bone_depth),
      hasMetalImplant: data.has_metal_implant,
      metalImplantDepth: data.metal_implant_depth ? Number(data.metal_implant_depth) : undefined,
      metalImplantSpan: data.metal_implant_span ? Number(data.metal_implant_span) : undefined,
      tissueType: data.tissue_type as TissueConfig["tissueType"],
      enableRiskSimulation: data.enable_risk_simulation,
      created_at: data.created_at || undefined,
      updated_at: data.updated_at || undefined,
    };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("tissue_configs")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
