import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig, TissuePresetId, tissuePresets } from "@/types/tissueConfig";
import { TissuePresetSelector } from "./TissuePresetSelector";
import { Settings, Dna, AlertTriangle } from "lucide-react";

interface TensLabConfigEditorProps {
  config: TensLabConfig;
  onChange: (config: TensLabConfig) => void;
}

export function TensLabConfigEditor({ config, onChange }: TensLabConfigEditorProps) {
  // Estado local para gerenciar presets
  const [selectedPresetId, setSelectedPresetId] = useState<TissuePresetId>(
    config.tissueConfigId ? "custom" : "forearm_slim"
  );
  const [customConfig, setCustomConfig] = useState<TissueConfig>(() => {
    const customPreset = tissuePresets.find(p => p.id === "custom");
    return {
      ...customPreset!.config,
      id: "custom",
    };
  });
  
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
      updateConfig({ tissueConfigId: undefined });
    } else {
      updateConfig({ tissueConfigId: presetId });
    }
  };
  
  const handleCustomConfigChange = (newCustomConfig: TissueConfig) => {
    setCustomConfig(newCustomConfig);
  };

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="general" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Configuração Geral
        </TabsTrigger>
        <TabsTrigger value="anatomy" className="flex items-center gap-2">
          <Dna className="h-4 w-4" />
          Anatomia e Tecidos
        </TabsTrigger>
        <TabsTrigger value="advanced" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Parâmetros Avançados
        </TabsTrigger>
      </TabsList>

      {/* Tab 1: Configuração Geral */}
      <TabsContent value="general" className="space-y-6 mt-6">
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
          </CardContent>
        </Card>

        {/* Elementos da Interface */}
        <Card>
          <CardHeader>
            <CardTitle>Elementos da Interface</CardTitle>
            <CardDescription>
              Controle quais visualizações e informações serão exibidas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-waveform" className="flex flex-col gap-1">
                <span className="font-medium">Mostrar Forma de Onda</span>
                <span className="text-sm text-muted-foreground">
                  Exibe o gráfico da forma de onda de estimulação
                </span>
              </Label>
              <Switch
                id="show-waveform"
                checked={config.showWaveform}
                onCheckedChange={(checked) => updateConfig({ showWaveform: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="show-comfort" className="flex flex-col gap-1">
                <span className="font-medium">Mostrar Card de Conforto</span>
                <span className="text-sm text-muted-foreground">
                  Exibe feedback sobre conforto e ativação sensorial
                </span>
              </Label>
              <Switch
                id="show-comfort"
                checked={config.showComfortCard}
                onCheckedChange={(checked) => updateConfig({ showComfortCard: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Anatomia e Tecidos */}
      <TabsContent value="anatomy" className="mt-6">
        <TissuePresetSelector
          selectedPresetId={selectedPresetId}
          customConfig={customConfig}
          onPresetChange={handlePresetChange}
          onCustomConfigChange={handleCustomConfigChange}
        />
      </TabsContent>

      {/* Tab 3: Parâmetros Avançados */}
      <TabsContent value="advanced" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Simulação de Riscos</CardTitle>
            <CardDescription>
              Configure thresholds e mensagens de alerta para o sistema de análise de riscos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-6 border border-dashed rounded-lg text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Funcionalidades avançadas serão adicionadas aqui</p>
              <p className="text-sm mt-1">
                Thresholds de risco, mensagens customizadas e testes de cenários
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}