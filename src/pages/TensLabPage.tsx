/**
 * TensLabPage - Página do Laboratório TENS (usa o novo layout V2)
 */

import { TensLabV2 } from "@/components/labs/tens-v2";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";

interface TensLabPageProps {
  config?: TensLabConfig;
  previewMode?: boolean;
}

export default function TensLabPage({ 
  config = defaultTensLabConfig, 
  previewMode = false 
}: TensLabPageProps) {
  return (
    <TensLabV2 
      config={config} 
      labName="Laboratório Virtual de TENS"
      showBackButton={!previewMode}
    />
  );
}
