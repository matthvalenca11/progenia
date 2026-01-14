/**
 * Central Registry for Virtual Labs
 * Defines all available lab types, their metadata, and routing information
 */

import { Waves, Activity, Thermometer } from "lucide-react";
import { LucideIcon } from "lucide-react";

export type LabType = "ultrasound" | "tens" | "ultrasound_therapy";

export interface LabRegistryEntry {
  id: LabType;
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  statusBadge?: "stable" | "beta" | "experimental";
}

export const labRegistry: LabRegistryEntry[] = [
  {
    id: "ultrasound",
    title: "Ultrassom Diagnóstico",
    description: "Simulador de ultrassom diagnóstico com visualização de tecidos e anatomia",
    route: "/labs",
    icon: Waves,
    statusBadge: "stable",
  },
  {
    id: "tens",
    title: "Eletroterapia TENS",
    description: "Simulador de estimulação elétrica transcutânea com análise de campo elétrico",
    route: "/labs",
    icon: Activity,
    statusBadge: "stable",
  },
  {
    id: "ultrasound_therapy",
    title: "Ultrassom Terapêutico",
    description: "Simulador de ultrassom terapêutico com análise de penetração, aquecimento e dose",
    route: "/labs",
    icon: Thermometer,
    statusBadge: "beta",
  },
];

export function getLabById(id: LabType): LabRegistryEntry | undefined {
  return labRegistry.find((lab) => lab.id === id);
}

export function getAllLabs(): LabRegistryEntry[] {
  return labRegistry;
}
