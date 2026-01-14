/**
 * UltrasoundTherapyLabPage - Página do Laboratório de Ultrassom Terapêutico
 */

import { UltrasoundTherapyLabV2 } from "@/components/labs/ultrasound-therapy/UltrasoundTherapyLabV2";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";

interface UltrasoundTherapyLabPageProps {
  config?: UltrasoundTherapyConfig;
  previewMode?: boolean;
}

export default function UltrasoundTherapyLabPage({ 
  config = defaultUltrasoundTherapyConfig, 
  previewMode = false 
}: UltrasoundTherapyLabPageProps) {
  return (
    <UltrasoundTherapyLabV2 
      config={config} 
      labName="Laboratório Virtual de Ultrassom Terapêutico"
      showBackButton={!previewMode}
    />
  );
}
