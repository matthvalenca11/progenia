import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig, TissuePresetId, tissuePresets } from "@/types/tissueConfig";
import { TissuePresetSelector } from "./TissuePresetSelector";
import { TensLabPreview } from "./TensLabPreview";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { Dna, Settings2 } from "lucide-react";

interface TensLabConfigEditorProps {
  config: TensLabConfig;
  onChange: (config: TensLabConfig) => void;
}

export function TensLabConfigEditor({ config, onChange }: TensLabConfigEditorProps) {
  // Estado local para gerenciar presets
  const [selectedPresetId, setSelectedPresetId] = useState<TissuePresetId>(
    config.tissueConfigId ? config.tissueConfigId : "custom"
  );
  const [tissueConfig, setTissueConfig] = useState<TissueConfig>(() => {
    const customPreset = tissuePresets.find(p => p.id === "custom");
    return {
      ...customPreset!.config,
      id: "custom",
      inclusions: [],
    };
  });
  
  // Estado para parâmetros de estimulação (preview)
  const [frequency, setFrequency] = useState(
    Math.floor((config.frequencyRange.min + config.frequencyRange.max) / 2)
  );
  const [pulseWidth, setPulseWidth] = useState(
    Math.floor((config.pulseWidthRange.min + config.pulseWidthRange.max) / 2)
  );
  const [intensity, setIntensity] = useState(
    Math.floor((config.intensityRange.min + config.intensityRange.max) / 2)
  );
  const [mode, setMode] = useState<TensMode>(
    config.allowedModes[0] || "convencional"
  );
  const [electrodeDistance, setElectrodeDistance] = useState(
    Math.floor((config.electrodeDistanceRange.min + config.electrodeDistanceRange.max) / 2)
  );
  
  const updateConfig = (updates: Partial<TensLabConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateEnabledControls = (key: keyof TensLabConfig["enabledControls"], value: boolean) => {
    updateConfig({
      enabledControls: {
        ...config.enabledControls,
        [key]: value,
      },
    });
  };

  const toggleMode = (mode: "convencional" | "acupuntura" | "burst" | "modulado") => {
    const allowedModes = config.allowedModes.includes(mode)
      ? config.allowedModes.filter(m => m !== mode)
      : [...config.allowedModes, mode];
    updateConfig({ allowedModes });
  };
  
  const handlePresetChange = (presetId: TissuePresetId) => {
    setSelectedPresetId(presetId);
    
    if (presetId === "custom") {
      const currentPreset = tissuePresets.find(p => p.id === selectedPresetId);
      if (currentPreset && selectedPresetId !== "custom") {
        setTissueConfig({ 
          ...currentPreset.config, 
          id: "custom",
          name: "Personalizado"
        });
      }
      updateConfig({ tissueConfigId: undefined });
    } else {
      const preset = tissuePresets.find(p => p.id === presetId);
      if (preset) {
        setTissueConfig({ ...preset.config, id: preset.id });
      }
      updateConfig({ tissueConfigId: presetId });
    }
  };
  
  const handleCustomConfigChange = (newConfig: TissueConfig) => {
    setTissueConfig({ ...newConfig });
  };
  
  const previewTissueConfig = useMemo(() => {
    const result = selectedPresetId === "custom" ? {
      ...tissueConfig,
      id: tissueConfig.id || "custom",
      name: tissueConfig.name || "Configuração Personalizada",
    } : (() => {
      const preset = tissuePresets.find(p => p.id === selectedPresetId);
      return preset ? { 
        ...preset.config, 
        id: preset.id,
        name: preset.label,
      } : {
        ...tissueConfig,
        id: tissueConfig.id || "custom",
        name: tissueConfig.name || "Configuração Personalizada",
      };
    })();
    
    return result;
  }, [selectedPresetId, tissueConfig]);

  return (
    <Tabs defaultValue="anatomy" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="anatomy" className="flex items-center gap-2">
          <Dna className="h-4 w-4" />
          Anatomia e Preview
        </TabsTrigger>
        <TabsTrigger value="controls" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Controles Disponíveis
        </TabsTrigger>
      </TabsList>

      {/* Tab 1: Anatomia com Preview Integrado */}
      <TabsContent value="anatomy" className="mt-6">
        {/* Layout: Controles à esquerda, Previews sticky à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,600px] gap-6 items-start">
          {/* COLUNA 1: Controles de Anatomia + Estimulação (scroll normal) */}
          <div className="space-y-6">
            {/* Cenário selecionado */}
            <Card className="p-4 bg-muted/30">
              <h4 className="text-sm font-semibold">Cenário anatômico</h4>
              <p className="text-sm text-muted-foreground mt-1">{previewTissueConfig.name || "Antebraço..."}</p>
            </Card>

            {/* Configuração de Anatomia */}
            <TissuePresetSelector
              selectedPresetId={selectedPresetId}
              tissueConfig={tissueConfig}
              onPresetChange={handlePresetChange}
              onCustomConfigChange={handleCustomConfigChange}
            />

            {/* Parâmetros de Estimulação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parâmetros de Estimulação</CardTitle>
                <CardDescription>
                  Ajuste para testar o laboratório
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.enabledControls.frequency && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Frequência</Label>
                      <span className="text-sm font-bold text-primary">{frequency} Hz</span>
                    </div>
                    <Slider
                      value={[frequency]}
                      onValueChange={(v) => setFrequency(v[0])}
                      min={config.frequencyRange.min}
                      max={config.frequencyRange.max}
                      step={1}
                    />
                  </div>
                )}
                
                {config.enabledControls.pulseWidth && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Largura de Pulso</Label>
                      <span className="text-sm font-bold text-primary">{pulseWidth} µs</span>
                    </div>
                    <Slider
                      value={[pulseWidth]}
                      onValueChange={(v) => setPulseWidth(v[0])}
                      min={config.pulseWidthRange.min}
                      max={config.pulseWidthRange.max}
                      step={10}
                    />
                  </div>
                )}
                
                {config.enabledControls.intensity && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Intensidade</Label>
                      <span className="text-sm font-bold text-primary">{intensity} mA</span>
                    </div>
                    <Slider
                      value={[intensity]}
                      onValueChange={(v) => setIntensity(v[0])}
                      min={config.intensityRange.min}
                      max={config.intensityRange.max}
                      step={1}
                    />
                  </div>
                )}
                
                {config.enabledControls.mode && config.allowedModes.length > 0 && (
                  <div>
                    <Label className="mb-3 block">Modo de Estimulação</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {config.allowedModes.map((m) => (
                        <Button
                          key={m}
                          variant={mode === m ? "default" : "outline"}
                          onClick={() => setMode(m)}
                          size="sm"
                          className="capitalize"
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {config.enabledControls.electrodeDistance && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Distância entre Eletrodos</Label>
                      <span className="text-sm font-bold text-primary">{electrodeDistance} cm</span>
                    </div>
                    <Slider
                      value={[electrodeDistance]}
                      onValueChange={(v) => setElectrodeDistance(v[0])}
                      min={config.electrodeDistanceRange.min}
                      max={config.electrodeDistanceRange.max}
                      step={0.5}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Distância maior = campo mais profundo, menor intensidade superficial
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* COLUNA 2: Previews sticky (2D + 3D) + Painel de Análises */}
          <div className="w-full flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <TensLabPreview
              config={config} 
              tissueConfig={previewTissueConfig}
              frequency={frequency}
              pulseWidth={pulseWidth}
              intensity={intensity}
              mode={mode}
              electrodeDistance={electrodeDistance}
            />
          </div>
        </div>
      </TabsContent>

      {/* Tab 2: Controles Disponíveis */}
      <TabsContent value="controls" className="space-y-6 mt-6">
        {/* Controles Disponíveis */}
        <Card>
          <CardHeader>
            <CardTitle>Controles Disponíveis</CardTitle>
            <CardDescription>
              Selecione quais parâmetros o aluno poderá ajustar durante o laboratório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-frequency" className="flex flex-col gap-1">
                <span className="font-medium">Frequência</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a frequência de estimulação (Hz)
                </span>
              </Label>
              <Switch
                id="enable-frequency"
                checked={config.enabledControls.frequency}
                onCheckedChange={(checked) =>
                  updateEnabledControls("frequency", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-pulse-width" className="flex flex-col gap-1">
                <span className="font-medium">Largura de Pulso</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a largura de pulso (µs)
                </span>
              </Label>
              <Switch
                id="enable-pulse-width"
                checked={config.enabledControls.pulseWidth}
                onCheckedChange={(checked) =>
                  updateEnabledControls("pulseWidth", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-intensity" className="flex flex-col gap-1">
                <span className="font-medium">Intensidade</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a intensidade (mA)
                </span>
              </Label>
              <Switch
                id="enable-intensity"
                checked={config.enabledControls.intensity}
                onCheckedChange={(checked) =>
                  updateEnabledControls("intensity", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-mode" className="flex flex-col gap-1">
                <span className="font-medium">Modo de Estimulação</span>
                <span className="text-sm text-muted-foreground">
                  Permite alternar entre modos (convencional, acupuntura, burst, modulado)
                </span>
              </Label>
              <Switch
                id="enable-mode"
                checked={config.enabledControls.mode}
                onCheckedChange={(checked) => updateEnabledControls("mode", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Modos de Estimulação Permitidos */}
        <Card>
          <CardHeader>
            <CardTitle>Modos de Estimulação</CardTitle>
            <CardDescription>
              Selecione quais modos o aluno poderá usar (se o controle de modo estiver habilitado)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mode-convencional"
                  checked={config.allowedModes.includes("convencional")}
                  onCheckedChange={() => toggleMode("convencional")}
                />
                <Label htmlFor="mode-convencional" className="flex flex-col">
                  <span className="font-medium">Convencional</span>
                  <span className="text-xs text-muted-foreground">
                    Frequências altas, analgesia por portão
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mode-acupuntura"
                  checked={config.allowedModes.includes("acupuntura")}
                  onCheckedChange={() => toggleMode("acupuntura")}
                />
                <Label htmlFor="mode-acupuntura" className="flex flex-col">
                  <span className="font-medium">Acupuntura</span>
                  <span className="text-xs text-muted-foreground">
                    Baixa frequência, liberação de endorfinas
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mode-burst"
                  checked={config.allowedModes.includes("burst")}
                  onCheckedChange={() => toggleMode("burst")}
                />
                <Label htmlFor="mode-burst" className="flex flex-col">
                  <span className="font-medium">Burst</span>
                  <span className="text-xs text-muted-foreground">
                    Rajadas de pulsos, analgesia profunda
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mode-modulado"
                  checked={config.allowedModes.includes("modulado")}
                  onCheckedChange={() => toggleMode("modulado")}
                />
                <Label htmlFor="mode-modulado" className="flex flex-col">
                  <span className="font-medium">Modulado</span>
                  <span className="text-xs text-muted-foreground">
                    Frequência variável, evita adaptação
                  </span>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Limites dos Parâmetros */}
        <Card>
          <CardHeader>
            <CardTitle>Limites dos Parâmetros</CardTitle>
            <CardDescription>
              Defina os valores mínimos e máximos que o aluno poderá usar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Frequência */}
            <div className="space-y-3">
              <Label className="font-medium">Frequência (Hz)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="freq-min" className="text-sm text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id="freq-min"
                    type="number"
                    value={config.frequencyRange.min}
                    onChange={(e) => {
                      updateConfig({
                        frequencyRange: {
                          ...config.frequencyRange,
                          min: Number(e.target.value),
                        },
                      });
                    }}
                    min={1}
                    max={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="freq-max" className="text-sm text-muted-foreground">
                    Máximo
                  </Label>
                  <Input
                    id="freq-max"
                    type="number"
                    value={config.frequencyRange.max}
                    onChange={(e) => {
                      updateConfig({
                        frequencyRange: {
                          ...config.frequencyRange,
                          max: Number(e.target.value),
                        },
                      });
                    }}
                    min={1}
                    max={200}
                  />
                </div>
              </div>
            </div>

            {/* Largura de Pulso */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium">Largura de Pulso (µs)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pulse-min" className="text-sm text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id="pulse-min"
                    type="number"
                    value={config.pulseWidthRange.min}
                    onChange={(e) => {
                      updateConfig({
                        pulseWidthRange: {
                          ...config.pulseWidthRange,
                          min: Number(e.target.value),
                        },
                      });
                    }}
                    min={50}
                    max={400}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pulse-max" className="text-sm text-muted-foreground">
                    Máximo
                  </Label>
                  <Input
                    id="pulse-max"
                    type="number"
                    value={config.pulseWidthRange.max}
                    onChange={(e) => {
                      updateConfig({
                        pulseWidthRange: {
                          ...config.pulseWidthRange,
                          max: Number(e.target.value),
                        },
                      });
                    }}
                    min={50}
                    max={400}
                  />
                </div>
              </div>
            </div>

            {/* Intensidade */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium">Intensidade (mA)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="int-min" className="text-sm text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id="int-min"
                    type="number"
                    value={config.intensityRange.min}
                    onChange={(e) => {
                      updateConfig({
                        intensityRange: {
                          ...config.intensityRange,
                          min: Number(e.target.value),
                        },
                      });
                    }}
                    min={0}
                    max={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-max" className="text-sm text-muted-foreground">
                    Máximo
                  </Label>
                  <Input
                    id="int-max"
                    type="number"
                    value={config.intensityRange.max}
                    onChange={(e) => {
                      updateConfig({
                        intensityRange: {
                          ...config.intensityRange,
                          max: Number(e.target.value),
                        },
                      });
                    }}
                    min={0}
                    max={80}
                  />
                </div>
              </div>
            </div>

            {/* Distância entre Eletrodos */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium">Distância entre Eletrodos (cm)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dist-min" className="text-sm text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id="dist-min"
                    type="number"
                    value={config.electrodeDistanceRange.min}
                    onChange={(e) => {
                      updateConfig({
                        electrodeDistanceRange: {
                          ...config.electrodeDistanceRange,
                          min: Number(e.target.value),
                        },
                      });
                    }}
                    min={2}
                    max={12}
                    step={0.5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dist-max" className="text-sm text-muted-foreground">
                    Máximo
                  </Label>
                  <Input
                    id="dist-max"
                    type="number"
                    value={config.electrodeDistanceRange.max}
                    onChange={(e) => {
                      updateConfig({
                        electrodeDistanceRange: {
                          ...config.electrodeDistanceRange,
                          max: Number(e.target.value),
                        },
                      });
                    }}
                    min={2}
                    max={12}
                    step={0.5}
                  />
                </div>
              </div>
            </div>

            {/* Distância entre Eletrodos */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium">Distância entre Eletrodos (cm)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dist-min" className="text-sm text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id="dist-min"
                    type="number"
                    value={config.electrodeDistanceRange.min}
                    onChange={(e) => {
                      updateConfig({
                        electrodeDistanceRange: {
                          ...config.electrodeDistanceRange,
                          min: Number(e.target.value),
                        },
                      });
                    }}
                    min={2}
                    max={12}
                    step={0.5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dist-max" className="text-sm text-muted-foreground">
                    Máximo
                  </Label>
                  <Input
                    id="dist-max"
                    type="number"
                    value={config.electrodeDistanceRange.max}
                    onChange={(e) => {
                      updateConfig({
                        electrodeDistanceRange: {
                          ...config.electrodeDistanceRange,
                          max: Number(e.target.value),
                        },
                      });
                    }}
                    min={2}
                    max={12}
                    step={0.5}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seções de Análise */}
        <Card>
          <CardHeader>
            <CardTitle>Seções de Análise</CardTitle>
            <CardDescription>
              Selecione quais análises serão exibidas no painel de insights do aluno
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-feedback-section" className="flex flex-col gap-1">
                <span className="font-medium">Feedback da Estimulação</span>
                <span className="text-sm text-muted-foreground">
                  Exibe barras de conforto e ativação sensorial
                </span>
              </Label>
              <Switch
                id="show-feedback-section"
                checked={config.showFeedbackSection ?? config.showComfortCard}
                onCheckedChange={(checked) => updateConfig({ 
                  showFeedbackSection: checked,
                  showComfortCard: checked, // manter compatibilidade
                })}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="show-risk-section" className="flex flex-col gap-1">
                <span className="font-medium">Análise de Riscos</span>
                <span className="text-sm text-muted-foreground">
                  Exibe score de risco e mensagens de segurança
                </span>
              </Label>
              <Switch
                id="show-risk-section"
                checked={config.showRiskSection ?? true}
                onCheckedChange={(checked) => updateConfig({ showRiskSection: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="show-waveform-section" className="flex flex-col gap-1">
                <span className="font-medium">Forma de Onda TENS</span>
                <span className="text-sm text-muted-foreground">
                  Exibe gráfico da forma de onda e métricas
                </span>
              </Label>
              <Switch
                id="show-waveform-section"
                checked={config.showWaveformSection ?? config.showWaveform}
                onCheckedChange={(checked) => updateConfig({ 
                  showWaveformSection: checked,
                  showWaveform: checked, // manter compatibilidade
                })}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}