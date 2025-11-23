import { BasicInfoSection } from "./BasicInfoSection";
import { AnatomyPresetSection } from "./AnatomyPresetSection";
import { SimulationFeaturesSection } from "./SimulationFeaturesSection";
import { StudentControlsSection } from "./StudentControlsSection";
import { UltrasoundPreview } from "./UltrasoundPreview";
import { AcousticLayersEditor } from "../AcousticLayersEditor";
import { InclusionsEditor } from "../InclusionsEditor";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { UltrasoundLayerConfig } from "@/types/acousticMedia";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, TestTube2 } from "lucide-react";

export const UltrasoundLabBuilder = () => {
  const { layers, setLayers, acousticLayers, setAcousticLayers, inclusions, setInclusions } = useUltrasoundLabStore();
  
  // Convert AnatomyLayer to UltrasoundLayerConfig for the editor
  const convertToLayerConfigs = (): UltrasoundLayerConfig[] => {
    // Use acousticLayers if available, otherwise convert from anatomy layers
    if (acousticLayers && acousticLayers.length > 0) {
      return acousticLayers;
    }
    
    if (!layers || layers.length === 0) return [];
    
    return layers.map((layer, index) => ({
      id: `layer-${index}`,
      mediumId: 'muscle', // Default, could be derived from echogenicity/texture
      name: layer.name,
      thicknessCm: (layer.depthRange[1] - layer.depthRange[0]) * 10, // Approximate
      noiseScale: 1.0,
      reflectivityBias: (layer.reflectivity - 0.5) || 0,
    }));
  };
  
  // Convert UltrasoundLayerConfig back to AnatomyLayer AND store acoustic layers
  const handleLayersChange = (newLayerConfigs: UltrasoundLayerConfig[]) => {
    // Store acoustic layers directly
    setAcousticLayers(newLayerConfigs);
    
    // Also convert to anatomy layers for compatibility
    const totalDepth = newLayerConfigs.reduce((sum, l) => sum + l.thicknessCm, 0);
    
    const anatomyLayers = newLayerConfigs.map((layerConfig, index) => {
      const startDepth = newLayerConfigs.slice(0, index).reduce((sum, l) => sum + l.thicknessCm, 0);
      const endDepth = startDepth + layerConfig.thicknessCm;
      
      return {
        name: layerConfig.name,
        depthRange: [startDepth / totalDepth, endDepth / totalDepth] as [number, number],
        reflectivity: 0.5 + (layerConfig.reflectivityBias || 0),
        echogenicity: 'isoechoic' as const,
        texture: 'homogeneous' as const,
        attenuationCoeff: 0.5,
        hasFlow: false,
      };
    });
    
    setLayers(anatomyLayers);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <BasicInfoSection />
        <AnatomyPresetSection />
        
        <Separator className="my-6" />
        
        <Tabs defaultValue="layers" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="layers" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Camadas Acústicas
            </TabsTrigger>
            <TabsTrigger value="inclusions" className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4" />
              Inclusões
            </TabsTrigger>
          </TabsList>
          <TabsContent value="layers" className="mt-4">
            <AcousticLayersEditor
              layers={convertToLayerConfigs()}
              onChange={handleLayersChange}
              inclusions={inclusions}
            />
          </TabsContent>
          <TabsContent value="inclusions" className="mt-4">
            <InclusionsEditor
              inclusions={inclusions}
              onChange={setInclusions}
            />
          </TabsContent>
        </Tabs>
        
        <Separator className="my-6" />
        
        <SimulationFeaturesSection />
        <StudentControlsSection />
      </div>
      
      <div>
        <UltrasoundPreview />
      </div>
    </div>
  );
};
