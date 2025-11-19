import { BasicInfoSection } from "./BasicInfoSection";
import { AnatomyPresetSection } from "./AnatomyPresetSection";
import { SimulationFeaturesSection } from "./SimulationFeaturesSection";
import { StudentControlsSection } from "./StudentControlsSection";
import { UltrasoundPreview } from "./UltrasoundPreview";

export const UltrasoundLabBuilder = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <BasicInfoSection />
        <AnatomyPresetSection />
        <SimulationFeaturesSection />
        <StudentControlsSection />
      </div>
      
      <div>
        <UltrasoundPreview />
      </div>
    </div>
  );
};
