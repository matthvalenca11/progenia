// Virtual lab service stub - table doesn't exist
export type VirtualLabType = "ultrasound" | "mri" | "thermal" | "electrotherapy" | "other";

export interface VirtualLab {
  id?: string;
  name: string;
  title: string;
  description?: string;
  lab_type: VirtualLabType;
  config_data: any;
  created_at?: string;
  updated_at?: string;
}

export const virtualLabService = {
  getAll: async () => {
    return [];
  },
  getAllLabs: async () => {
    return [];
  },
  getById: async (id: string) => {
    return null;
  },
  getLabById: async (id: string) => {
    return null;
  },
  create: async (lab: any) => {
    throw new Error("Virtual labs table not configured");
  },
  createLab: async (lab: any) => {
    throw new Error("Virtual labs table not configured");
  },
  update: async (id: string, lab: any) => {
    throw new Error("Virtual labs table not configured");
  },
  updateLab: async (id: string, lab: any) => {
    throw new Error("Virtual labs table not configured");
  },
  delete: async (id: string) => {
    throw new Error("Virtual labs table not configured");
  },
  deleteLab: async (id: string) => {
    throw new Error("Virtual labs table not configured");
  },
  getLabUsageCount: async (labId: string) => {
    return 0;
  }
};
