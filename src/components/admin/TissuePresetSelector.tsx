import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TissueConfig, TissuePreset, tissuePresets, TissuePresetId } from "@/types/tissueConfig";
import { TensLateral3DView } from "@/components/labs/TensLateral3DView";

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tissuePresets.map((preset) => (
              <Button
                key={preset.id}
                variant={selectedPresetId === preset.id ? "default" : "outline"}
                className="h-auto p-4 flex flex-col items-start gap-2 hover:scale-[1.02] transition-transform"
                onClick={() => onPresetChange(preset.id)}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-semibold text-sm">{preset.label}</span>
                  {preset.config.hasMetalImplant && (
                    <Badge variant="secondary" className="text-xs">⚡</Badge>
                  )}
                  {preset.isCustom && (
                    <Badge variant="secondary" className="text-xs">✏️</Badge>
                  )}
                </div>
                <p className="text-xs text-left text-muted-foreground line-clamp-2">
                  {preset.description}
                </p>
              </Button>
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
            <TensLateral3DView
              activationLevel={50}
              comfortLevel={70}
              frequency={80}
              intensity={15}
              pulseWidth={200}
              mode="convencional"
              tissueConfig={previewConfig}
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
