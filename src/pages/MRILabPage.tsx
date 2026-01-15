/**
 * MRI Lab Page
 */

import { MRILabV2 } from "@/components/labs/mri/MRILabV2";
import { MRILabConfig, defaultMRILabConfig } from "@/types/mriLabConfig";

interface MRILabPageProps {
  config?: MRILabConfig;
}

export default function MRILabPage({ config = defaultMRILabConfig }: MRILabPageProps) {
  return <MRILabV2 config={config} />;
}
