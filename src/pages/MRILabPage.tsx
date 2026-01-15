/**
 * MRI Lab Page
 */

import { useEffect } from "react";
import { MRILabV2 } from "@/components/labs/mri/MRILabV2";
import { MRILabConfig, defaultMRILabConfig } from "@/types/mriLabConfig";
import { useMRILabStore } from "@/stores/mriLabStore";

interface MRILabPageProps {
  config?: MRILabConfig;
}

export default function MRILabPage({ config = defaultMRILabConfig }: MRILabPageProps) {
  const { initIfNeeded } = useMRILabStore();
  
  // Ensure initialization on mount
  useEffect(() => {
    console.log("[MRILabPage] ✅ Component mounted, calling initIfNeeded");
    initIfNeeded("MRILabPage mount", config);
  }, []);
  
  return <MRILabV2 config={config} />;
}
