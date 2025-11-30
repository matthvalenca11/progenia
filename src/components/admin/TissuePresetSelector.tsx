import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TissueConfig, TissuePreset, tissuePresets, TissuePresetId } from "@/types/tissueConfig";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";

interface TissuePresetSelectorProps {
  selectedPresetId: TissuePresetId;
  customConfig: TissueConfig;
  onPresetChange: (presetId: TissuePresetId) => void;
  onCustomConfigChange: (config: TissueConfig) => void;
}

export function TissuePresetSelector({
  selectedPresetId,
  customConfig,
  onPresetChange,
  onCustomConfigChange,
}: TissuePresetSelectorProps) {
  const selectedPreset = tissuePresets.find(p => p.id === selectedPresetId);
  const isCustom = selectedPresetId === "custom";
  
  // Config para preview - usa custom se selecionado, caso contrário usa o preset
  const previewConfig: TissueConfig = isCustom 
    ? customConfig 
    : {
        ...selectedPreset!.config,
        id: selectedPreset!.id,
      };

  const updateCustomConfig = (updates: Partial<TissueConfig>) => {
    onCustomConfigChange({ ...customConfig, ...updates });
  };
  
  // Calculate risk for preview
  const previewRisk = useMemo(() => 
    simulateTissueRisk(
      {
        frequencyHz: 80,
        pulseWidthUs: 200,
        intensitymA: 15,
        mode: "convencional",
      },
      previewConfig
    ),
    [previewConfig]
  );

  return (
    <div className="space-y-6">
      {/* Seletor de Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Cenário Anatômico</CardTitle>
          <CardDescription>
            Escolha um preset predefinido ou configure manualmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tissuePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onPresetChange(preset.id)}
                className={`
                  w-full h-28 p-4 rounded-xl border shadow-sm overflow-hidden
                  transition-all duration-200
                  ${selectedPresetId === preset.id 
                    ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                    : 'bg-card hover:bg-accent hover:border-accent-foreground/20'
                  }
                `}
              >
                <div className="flex flex-col h-full justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-left truncate flex-1">
                      {preset.label}
                    </h3>
                    <div className="flex gap-1 flex-shrink-0">
                      {preset.config.hasMetalImplant && (
                        <span className="text-xs">⚡</span>
                      )}
                      {preset.isCustom && (
                        <span className="text-xs">✏️</span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm text-left line-clamp-1 ${
                    selectedPresetId === preset.id 
                      ? 'text-primary-foreground/80' 
                      : 'text-muted-foreground'
                  }`}>
                    {preset.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview da Anatomia */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Preview da Anatomia</CardTitle>
          <CardDescription>
            Visualização das camadas anatômicas configuradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] rounded-lg overflow-hidden">
            <TensSemi3DView
              frequencyHz={80}
              pulseWidthUs={200}
              intensitymA={15}
              mode="convencional"
              activationLevel={50}
              comfortLevel={70}
              tissueConfig={previewConfig}
              riskResult={previewRisk}
            />
          </div>
        </CardContent>
      </Card>

      {/* Editor Manual - apenas se Custom estiver selecionado */}
      {isCustom && (
        <Card>
          <CardHeader>
            <CardTitle>Ajustes Manuais</CardTitle>
            <CardDescription>
              Configure manualmente as espessuras das camadas e implantes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Espessura da Pele */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Espessura da Pele</Label>
                <span className="text-sm text-muted-foreground">
                  {(customConfig.skinThickness * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[customConfig.skinThickness * 100]}
                onValueChange={(v) => updateCustomConfig({ skinThickness: v[0] / 100 })}
                min={5}
                max={30}
                step={1}
                className="py-2"
              />
            </div>

            {/* Espessura da Gordura */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Espessura do Tecido Adiposo</Label>
                <span className="text-sm text-muted-foreground">
                  {(customConfig.fatThickness * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[customConfig.fatThickness * 100]}
                onValueChange={(v) => updateCustomConfig({ fatThickness: v[0] / 100 })}
                min={0}
                max={70}
                step={1}
                className="py-2"
              />
            </div>

            {/* Espessura do Músculo */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Espessura Muscular</Label>
                <span className="text-sm text-muted-foreground">
                  {(customConfig.muscleThickness * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[customConfig.muscleThickness * 100]}
                onValueChange={(v) => updateCustomConfig({ muscleThickness: v[0] / 100 })}
                min={10}
                max={80}
                step={1}
                className="py-2"
              />
            </div>

            {/* Profundidade do Osso */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Profundidade Óssea</Label>
                <span className="text-sm text-muted-foreground">
                  {(customConfig.boneDepth * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[customConfig.boneDepth * 100]}
                onValueChange={(v) => updateCustomConfig({ boneDepth: v[0] / 100 })}
                min={20}
                max={95}
                step={1}
                className="py-2"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label htmlFor="hasImplant" className="text-base">
                    Possui Implante Metálico
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Simula presença de prótese ou parafuso metálico
                  </p>
                </div>
                <Switch
                  id="hasImplant"
                  checked={customConfig.hasMetalImplant}
                  onCheckedChange={(checked) => 
                    updateCustomConfig({ 
                      hasMetalImplant: checked,
                      metalImplantDepth: checked ? 0.5 : undefined,
                      metalImplantSpan: checked ? 0.6 : undefined,
                    })
                  }
                />
              </div>

              {/* Configurações do Implante */}
              {customConfig.hasMetalImplant && (
                <div className="space-y-6 pl-4 border-l-2 border-amber-500/30">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-sm">Profundidade do Implante</Label>
                      <span className="text-sm text-muted-foreground">
                        {((customConfig.metalImplantDepth || 0.5) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[(customConfig.metalImplantDepth || 0.5) * 100]}
                      onValueChange={(v) => updateCustomConfig({ metalImplantDepth: v[0] / 100 })}
                      min={20}
                      max={80}
                      step={1}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-sm">Extensão do Implante</Label>
                      <span className="text-sm text-muted-foreground">
                        {((customConfig.metalImplantSpan || 0.6) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[(customConfig.metalImplantSpan || 0.6) * 100]}
                      onValueChange={(v) => updateCustomConfig({ metalImplantSpan: v[0] / 100 })}
                      min={20}
                      max={90}
                      step={1}
                      className="py-2"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
