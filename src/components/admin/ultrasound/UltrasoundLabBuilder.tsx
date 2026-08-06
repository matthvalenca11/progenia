import { BasicInfoSection } from "./BasicInfoSection";
import { UltrasoundVideoFeaturePanel } from "./UltrasoundVideoFeaturePanel";
import { AnatomyPresetSection } from "./AnatomyPresetSection";
import { SimulationFeaturesSection } from "./SimulationFeaturesSection";
import { StudentControlsSection } from "./StudentControlsSection";
import { SimulationResourcesSection } from "./SimulationResourcesSection";
import { UltrasoundPreview } from "./UltrasoundPreview";
import { AcousticLayersEditor } from "../AcousticLayersEditor";
import { InclusionsEditor } from "../InclusionsEditor";
import { LabVideoUploader } from "../LabVideoUploader";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { UltrasoundLayerConfig, getAcousticMedium } from "@/types/acousticMedia";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, TestTube2, Sparkles, Sliders } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  adminLabConfigColumnClass,
  adminLabEditorGridClass,
  adminLabPreviewColumnClass,
} from "@/components/admin/adminLabEditorLayout";

interface UltrasoundLabBuilderProps {
  videoUrl?: string;
  onVideoChange?: (url: string | undefined) => void;
}

export const UltrasoundLabBuilder = ({ videoUrl, onVideoChange }: UltrasoundLabBuilderProps) => {
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
      const medium = getAcousticMedium(layerConfig.mediumId);
      
      return {
        name: layerConfig.name,
        depthRange: [startDepth / totalDepth, endDepth / totalDepth] as [number, number],
        reflectivity: 0.5 + (layerConfig.reflectivityBias || 0),
        echogenicity: medium.baseEchogenicity as 'anechoic' | 'hypoechoic' | 'isoechoic' | 'hyperechoic',
        texture: layerConfig.mediumId === 'muscle' ? 'striated' as const : 
                 layerConfig.mediumId === 'tendon' ? 'fibrillar' as const : 
                 layerConfig.mediumId === 'fat' ? 'heterogeneous' as const :
                 'homogeneous' as const,
        attenuationCoeff: medium.attenuation_dB_per_cm_MHz,
        hasFlow: layerConfig.mediumId === 'blood',
      };
    });
    
    setLayers(anatomyLayers);
  };
  
  const getTotalDepth = () => {
    const layerConfigs = convertToLayerConfigs();
    return layerConfigs.reduce((sum, layer) => sum + layer.thicknessCm, 0);
  };
  
  return (
    <div className={adminLabEditorGridClass}>
      <div className={adminLabConfigColumnClass}>
        <BasicInfoSection />
        
        {/* Video Uploader - integrated in left column */}
        {onVideoChange && (
          <>
            <LabVideoUploader
              videoUrl={videoUrl}
              onVideoChange={onVideoChange}
            />
            <UltrasoundVideoFeaturePanel videoUrl={videoUrl} />
          </>
        )}
        
        <AnatomyPresetSection />
        
        <Separator className="my-6" />
        
        <Tabs defaultValue="layers" className="w-full relative z-10">
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
              <Sliders className="h-4 w-4" />
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
      
      <div className={adminLabPreviewColumnClass}>
        <UltrasoundPreview />
        
        {/* Schematic visualization */}
        {convertToLayerConfigs().length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <Label className="mb-3 block text-base font-semibold">
                Visualização esquemática (profundidade total: {getTotalDepth().toFixed(1)} cm)
              </Label>
              <div
                className="relative flex min-h-[10rem] flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-1"
                style={{ minHeight: `${Math.max(getTotalDepth() * 28, 160)}px` }}
              >
                {convertToLayerConfigs().map((layer) => {
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
                      className={cn(
                        colorMap[layer.mediumId] || "bg-gray-300",
                        "flex min-h-[1.75rem] shrink-0 items-center justify-between rounded px-2 py-1 text-xs",
                      )}
                      style={{ flex: `${layer.thicknessCm} 0 auto` }}
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
                  const size =
                    typeof inclusion.sizeCm === "number" ? inclusion.sizeCm : inclusion.sizeCm.height;
                  const heightPercent = (size / totalDepth) * 100;
                  const lateralOffsetPercent = inclusion.centerLateralPos * 30;
                  const leftPosition = 50 + lateralOffsetPercent;

                  return (
                    <div
                      key={`${inclusion.id}-${inclusion.centerLateralPos}-${inclusion.centerDepthCm}`}
                      className="pointer-events-none absolute flex items-center justify-center rounded-full border-2 border-dashed border-orange-500 bg-orange-500/20"
                      style={{
                        top: `${topPercent - heightPercent / 2}%`,
                        left: `${leftPosition}%`,
                        transform: "translate(-50%, 0)",
                        width: `${Math.max(heightPercent, 8)}%`,
                        height: `${Math.max(heightPercent, 8)}%`,
                        minWidth: "2.5rem",
                        minHeight: "2.5rem",
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
