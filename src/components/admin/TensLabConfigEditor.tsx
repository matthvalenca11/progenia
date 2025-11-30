import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig } from "@/types/tissueConfig";
import { tissueConfigService } from "@/services/tissueConfigService";

interface TensLabConfigEditorProps {
  config: TensLabConfig;
  onChange: (config: TensLabConfig) => void;
}

export function TensLabConfigEditor({ config, onChange }: TensLabConfigEditorProps) {
  const [tissueConfigs, setTissueConfigs] = useState<TissueConfig[]>([]);
  
  useEffect(() => {
    const loadTissueConfigs = async () => {
      try {
        const configs = await tissueConfigService.getAll();
        setTissueConfigs(configs);
      } catch (error) {
        console.error("Error loading tissue configs:", error);
      }
    };
    
    loadTissueConfigs();
  }, []);
  
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

      {/* Configuração Anatômica */}
      <Card>
        <CardHeader>
          <CardTitle>Cenário Anatômico</CardTitle>
          <CardDescription>
            Selecione a configuração de tecido para simulação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label htmlFor="tissueConfig">Anatomia TENS</Label>
            <Select 
              value={config.tissueConfigId || "none"} 
              onValueChange={(value) => updateConfig({ tissueConfigId: value === "none" ? undefined : value })}
            >
              <SelectTrigger id="tissueConfig">
                <SelectValue placeholder="Selecione uma anatomia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Padrão (Antebraço)</SelectItem>
                {tissueConfigs.map((tc) => (
                  <SelectItem key={tc.id} value={tc.id}>
                    {tc.name}
                    {tc.hasMetalImplant && " ⚡"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A anatomia selecionada afetará a visualização 3D e a análise de riscos
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
