import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig, TissuePresetId, tissuePresets } from "@/types/tissueConfig";
import { TissuePresetSelector } from "./TissuePresetSelector";

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
      // Quando mudar para custom, manter config atual ou usar padrão
      updateConfig({ tissueConfigId: undefined });
    } else {
      // Para presets predefinidos, vamos usar o tissueConfigId como o preset id
      // Nota: isso requer que os presets também estejam salvos no banco
      updateConfig({ tissueConfigId: presetId });
    }
  };
  
  const handleCustomConfigChange = (newCustomConfig: TissueConfig) => {
    setCustomConfig(newCustomConfig);
    // Quando custom config muda, salvamos temporariamente no config
    // Na prática, você pode querer salvar isso no banco também
  };

  return (
    <div className="space-y-6">
      {/* Controles Habilitados */}
      <Card>
        <CardHeader>
          <CardTitle>Controles Disponíveis</CardTitle>
          <CardDescription>
            Selecione quais controles estarão disponíveis para os alunos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "frequency", label: "Frequência (Hz)" },
            { key: "pulseWidth", label: "Largura de Pulso (µs)" },
            { key: "intensity", label: "Intensidade (mA)" },
            { key: "mode", label: "Modo de Estimulação" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={config.enabledControls[key as keyof typeof config.enabledControls]}
                onCheckedChange={(checked) =>
                  updateEnabledControls(key as keyof typeof config.enabledControls, checked)
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modos Permitidos */}
      <Card>
        <CardHeader>
          <CardTitle>Modos de Estimulação</CardTitle>
          <CardDescription>
            Selecione quais modos estarão disponíveis para os alunos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { value: "convencional", label: "Convencional", desc: "Alta frequência (50-100 Hz)" },
            { value: "acupuntura", label: "Acupuntura", desc: "Baixa frequência (2-10 Hz)" },
            { value: "burst", label: "Burst", desc: "Grupos de pulsos de alta frequência" },
            { value: "modulado", label: "Modulado", desc: "Amplitude variável" },
          ].map(({ value, label, desc }) => (
            <div key={value} className="flex items-start space-x-3">
              <Checkbox
                id={value}
                checked={config.allowedModes.includes(value as any)}
                onCheckedChange={() => toggleMode(value as any)}
              />
              <div className="space-y-1 leading-none">
                <label
                  htmlFor={value}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {label}
                </label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ranges de Valores */}
      <Card>
        <CardHeader>
          <CardTitle>Limites dos Parâmetros</CardTitle>
          <CardDescription>
            Defina os valores mínimo e máximo permitidos para cada parâmetro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Frequência */}
          <div className="space-y-3">
            <Label>Frequência (Hz)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="freq-min" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="freq-min"
                  type="number"
                  value={config.frequencyRange.min}
                  onChange={(e) =>
                    updateConfig({
                      frequencyRange: { ...config.frequencyRange, min: Number(e.target.value) },
                    })
                  }
                  min={1}
                  max={200}
                />
              </div>
              <div>
                <Label htmlFor="freq-max" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="freq-max"
                  type="number"
                  value={config.frequencyRange.max}
                  onChange={(e) =>
                    updateConfig({
                      frequencyRange: { ...config.frequencyRange, max: Number(e.target.value) },
                    })
                  }
                  min={1}
                  max={200}
                />
              </div>
            </div>
          </div>

          {/* Largura de Pulso */}
          <div className="space-y-3">
            <Label>Largura de Pulso (µs)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pw-min" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="pw-min"
                  type="number"
                  value={config.pulseWidthRange.min}
                  onChange={(e) =>
                    updateConfig({
                      pulseWidthRange: { ...config.pulseWidthRange, min: Number(e.target.value) },
                    })
                  }
                  min={50}
                  max={400}
                />
              </div>
              <div>
                <Label htmlFor="pw-max" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="pw-max"
                  type="number"
                  value={config.pulseWidthRange.max}
                  onChange={(e) =>
                    updateConfig({
                      pulseWidthRange: { ...config.pulseWidthRange, max: Number(e.target.value) },
                    })
                  }
                  min={50}
                  max={400}
                />
              </div>
            </div>
          </div>

          {/* Intensidade */}
          <div className="space-y-3">
            <Label>Intensidade (mA)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="int-min" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="int-min"
                  type="number"
                  value={config.intensityRange.min}
                  onChange={(e) =>
                    updateConfig({
                      intensityRange: { ...config.intensityRange, min: Number(e.target.value) },
                    })
                  }
                  min={0}
                  max={80}
                />
              </div>
              <div>
                <Label htmlFor="int-max" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="int-max"
                  type="number"
                  value={config.intensityRange.max}
                  onChange={(e) =>
                    updateConfig({
                      intensityRange: { ...config.intensityRange, max: Number(e.target.value) },
                    })
                  }
                  min={0}
                  max={80}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Elementos Visuais */}
      <Card>
        <CardHeader>
          <CardTitle>Elementos da Interface</CardTitle>
          <CardDescription>
            Configure quais elementos visuais serão exibidos no laboratório
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showWaveform">Gráfico de Forma de Onda</Label>
              <p className="text-xs text-muted-foreground">
                Exibir análise gráfica da forma de onda TENS
              </p>
            </div>
            <Switch
              id="showWaveform"
              checked={config.showWaveform}
              onCheckedChange={(checked) => updateConfig({ showWaveform: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showComfortCard">Card de Feedback</Label>
              <p className="text-xs text-muted-foreground">
                Exibir níveis de conforto e ativação sensorial
              </p>
            </div>
            <Switch
              id="showComfortCard"
              checked={config.showComfortCard}
              onCheckedChange={(checked) => updateConfig({ showComfortCard: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seletor de Presets Anatômicos */}
      <TissuePresetSelector
        selectedPresetId={selectedPresetId}
        customConfig={customConfig}
        onPresetChange={handlePresetChange}
        onCustomConfigChange={handleCustomConfigChange}
      />
    </div>
  );
}
