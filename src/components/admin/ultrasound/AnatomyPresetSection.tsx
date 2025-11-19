import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { ULTRASOUND_PRESETS } from "@/config/ultrasoundPresets";
import { UltrasoundAnatomyPresetId } from "@/types/ultrasoundPresets";
import { Info, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export const AnatomyPresetSection = () => {
  const { presetId, setPresetId } = useUltrasoundLabStore();
  
  const currentPreset = Object.values(ULTRASOUND_PRESETS).find(p => p.id === presetId);
  
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
