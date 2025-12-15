import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { ULTRASOUND_PRESETS, getDefaultLayersForPreset, getDefaultInclusionsForPreset } from "@/config/ultrasoundPresets";
import { UltrasoundAnatomyPresetId } from "@/types/ultrasoundPresets";
import { Info, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { getAcousticMedium } from "@/types/acousticMedia";

export const AnatomyPresetSection = () => {
  const { 
    presetId, 
    setPresetId,
    setLayers,
    setAcousticLayers,
    setInclusions,
    setTransducerType,
    setFrequency,
    setDepth,
    setFocus,
    setGain
  } = useUltrasoundLabStore();
  
  const currentPreset = Object.values(ULTRASOUND_PRESETS).find(p => p.id === presetId);

  // Auto-load preset configuration when preset changes
  useEffect(() => {
    if (!presetId || presetId === 'custom') return;

    const preset = ULTRASOUND_PRESETS[presetId as UltrasoundAnatomyPresetId];
    if (!preset) return;

    // Load layers from preset and convert to AnatomyLayer format
    const layerConfigs = getDefaultLayersForPreset(presetId as UltrasoundAnatomyPresetId);
    const totalDepth = layerConfigs.reduce((sum, l) => sum + l.thicknessCm, 0);
    
    const anatomyLayers = layerConfigs.map((layerConfig, index) => {
      const startDepth = layerConfigs.slice(0, index).reduce((sum, l) => sum + l.thicknessCm, 0);
      const endDepth = startDepth + layerConfig.thicknessCm;
      const medium = getAcousticMedium(layerConfig.mediumId);
      
      return {
        name: layerConfig.name,
        depthRange: [startDepth / totalDepth, endDepth / totalDepth] as [number, number],
        reflectivity: 0.5 + (layerConfig.reflectivityBias || 0),
        echogenicity: medium.baseEchogenicity,
        texture: layerConfig.mediumId === 'muscle' ? 'striated' as const : 
                 layerConfig.mediumId === 'tendon' ? 'fibrillar' as const : 
                 layerConfig.mediumId === 'fat' ? 'heterogeneous' as const :
                 'homogeneous' as const,
        attenuationCoeff: medium.attenuation_dB_per_cm_MHz,
        hasFlow: layerConfig.mediumId === 'blood',
        flowVelocity: layerConfig.mediumId === 'blood' ? 20 : undefined,
      };
    });

    setLayers(anatomyLayers);
    
    // CRITICAL: Also set acousticLayers directly from preset to preserve mediumId
    // This ensures the editor has the correct layer configs with all properties
    setAcousticLayers(layerConfigs);

    // Load inclusions from preset
    const presetInclusions = getDefaultInclusionsForPreset(presetId as UltrasoundAnatomyPresetId);
    setInclusions(presetInclusions);

    // Apply recommended parameters from preset
    setTransducerType(preset.transducerType);
    setFrequency(preset.recommendedFrequencyMHz);
    setDepth(preset.recommendedDepthCm);
    setFocus(preset.recommendedFocusCm);
    setGain(preset.recommendedGain);
  }, [presetId, setLayers, setAcousticLayers, setInclusions, setTransducerType, setFrequency, setDepth, setFocus, setGain]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Preset Anatômico
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Escolha uma anatomia pré-configurada com camadas e propriedades acústicas realistas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>Selecione uma anatomia baseada em atlas clínicos reais</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Preset Clínico</Label>
          <Select value={presetId} onValueChange={(value) => setPresetId(value as UltrasoundAnatomyPresetId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ULTRASOUND_PRESETS).map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {currentPreset && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">{currentPreset.clinicalTagline}</p>
                <p className="text-xs text-muted-foreground">{currentPreset.shortDescription}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Transdutor: {currentPreset.transducerType === 'linear' ? 'Linear' : currentPreset.transducerType === 'convex' ? 'Convexo' : 'Microconvexo'}
              </Badge>
              <Badge variant="outline">
                {currentPreset.recommendedFrequencyMHz} MHz
              </Badge>
              <Badge variant="outline">
                {currentPreset.recommendedDepthCm} cm
              </Badge>
              <Badge variant="outline">
                Foco: {currentPreset.recommendedFocusCm} cm
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
