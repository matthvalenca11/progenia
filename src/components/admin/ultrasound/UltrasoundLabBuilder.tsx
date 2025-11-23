import { BasicInfoSection } from "./BasicInfoSection";
import { AnatomyPresetSection } from "./AnatomyPresetSection";
import { SimulationFeaturesSection } from "./SimulationFeaturesSection";
import { StudentControlsSection } from "./StudentControlsSection";
import { SimulationResourcesSection } from "./SimulationResourcesSection";
import { UltrasoundPreview } from "./UltrasoundPreview";
import { AcousticLayersEditor } from "../AcousticLayersEditor";
import { InclusionsEditor } from "../InclusionsEditor";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { UltrasoundLayerConfig, getAcousticMedium } from "@/types/acousticMedia";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, TestTube2, Sparkles, UserCog } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

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
  
  const getTotalDepth = () => {
    const layerConfigs = convertToLayerConfigs();
    return layerConfigs.reduce((sum, layer) => sum + layer.thicknessCm, 0);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,600px] gap-6 items-start relative">
      <div className="space-y-6">
        <BasicInfoSection />
        <AnatomyPresetSection />
        
        <Separator className="my-6" />
        
        <Tabs defaultValue="layers" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="layers" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Camadas Acústicas
            </TabsTrigger>
            <TabsTrigger value="inclusions" className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4" />
              Inclusões
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Recursos da Simulação
            </TabsTrigger>
            <TabsTrigger value="controls" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Controles do Estudante
            </TabsTrigger>
          </TabsList>
          <TabsContent value="layers" className="mt-4">
            <AcousticLayersEditor
              layers={convertToLayerConfigs()}
              onChange={handleLayersChange}
            />
          </TabsContent>
          <TabsContent value="inclusions" className="mt-4">
            <InclusionsEditor
              inclusions={inclusions}
              onChange={setInclusions}
            />
          </TabsContent>
          <TabsContent value="resources" className="mt-4">
            <SimulationResourcesSection />
          </TabsContent>
          <TabsContent value="controls" className="mt-4">
            <StudentControlsSection />
          </TabsContent>
        </Tabs>
        
        <Separator className="my-6" />
        
      </div>
      
      <div className="lg:fixed lg:top-20 lg:right-8 lg:w-[600px] space-y-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <UltrasoundPreview />
        
        {/* Schematic visualization */}
        {convertToLayerConfigs().length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <Label className="mb-3 block text-base font-semibold">
                Visualização esquemática (profundidade total: {getTotalDepth().toFixed(1)} cm)
              </Label>
              <div className="relative space-y-1">
                {convertToLayerConfigs().map((layer, index) => {
                  const medium = getAcousticMedium(layer.mediumId);
                  const heightPercent = (layer.thicknessCm / getTotalDepth()) * 100;
                  
                  // Color mapping based on medium
                  const colorMap: Record<string, string> = {
                    skin: "bg-amber-200",
                    fat: "bg-yellow-300",
                    muscle: "bg-red-300",
                    tendon: "bg-gray-300",
                    bone_cortical: "bg-gray-100",
                    water: "bg-blue-200",
                    blood: "bg-red-400",
                    cyst_fluid: "bg-blue-100",
                    liver: "bg-orange-300",
                    cartilage: "bg-gray-200",
                    generic_soft: "bg-pink-200",
                  };
                  
                  return (
                    <div
                      key={layer.id}
                      className={`${colorMap[layer.mediumId] || "bg-gray-300"} rounded px-2 py-1 flex items-center justify-between text-xs`}
                      style={{ height: `${Math.max(heightPercent, 10)}px` }}
                    >
                      <span className="font-medium">{layer.name}</span>
                      <span>{layer.thicknessCm.toFixed(1)} cm</span>
                    </div>
                  );
                })}
                
                {/* Overlay inclusions */}
                {inclusions.map((inclusion) => {
                  const totalDepth = getTotalDepth();
                  const topPercent = (inclusion.centerDepthCm / totalDepth) * 100;
                  const size = typeof inclusion.sizeCm === 'number' ? inclusion.sizeCm : inclusion.sizeCm.height;
                  const heightPercent = (size / totalDepth) * 100;
                  
                  // Calculate lateral position (centerLateralPos is from -1 to 1)
                  // Convert to percentage offset from center (50%)
                  const lateralOffsetPercent = inclusion.centerLateralPos * 30; // 30% max offset from center
                  const leftPosition = 50 + lateralOffsetPercent; // 50% is center
                  
                  return (
                    <div
                      key={`${inclusion.id}-${inclusion.centerLateralPos}-${inclusion.centerDepthCm}`}
                      className="absolute border-2 border-orange-500 border-dashed rounded-full bg-orange-500/20 flex items-center justify-center"
                      style={{
                        top: `${topPercent - heightPercent / 2}%`,
                        left: `${leftPosition}%`,
                        transform: 'translate(-50%, 0)',
                        width: `${heightPercent}%`,
                        height: `${heightPercent}%`,
                        minWidth: '40px',
                        minHeight: '40px',
                      }}
                    >
                      <span className="text-xs font-bold text-orange-700">{inclusion.label}</span>
                    </div>
                  );
                })}
              
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
