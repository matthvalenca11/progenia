import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UltrasoundTherapyConfig, AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { UltrasoundTherapyLabPreview } from "./UltrasoundTherapyLabPreview";
import { Dna, Settings2 } from "lucide-react";

interface UltrasoundTherapyLabConfigEditorProps {
  config: UltrasoundTherapyConfig;
  onChange: (config: UltrasoundTherapyConfig) => void;
}

export function UltrasoundTherapyLabConfigEditor({ config, onChange }: UltrasoundTherapyLabConfigEditorProps) {
  // Estado para parâmetros de preview
  const [frequency, setFrequency] = useState(config.frequency);
  const [intensity, setIntensity] = useState(config.intensity);
  const [era, setEra] = useState(config.era);
  const [mode, setMode] = useState<"continuous" | "pulsed">(config.mode);
  const [dutyCycle, setDutyCycle] = useState(config.dutyCycle);
  const [duration, setDuration] = useState(config.duration);
  const [coupling, setCoupling] = useState<"good" | "poor">(config.coupling);
  const [movement, setMovement] = useState<"stationary" | "scanning">(config.movement);
  const [scenario, setScenario] = useState<AnatomicalScenario>(config.scenario);
  
  const updateConfig = (updates: Partial<UltrasoundTherapyConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateEnabledControls = (key: keyof UltrasoundTherapyConfig["enabledControls"], value: boolean) => {
    updateConfig({
      enabledControls: {
        ...config.enabledControls,
        [key]: value,
      },
    });
  };

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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,600px] gap-6 items-start">
          {/* COLUNA 1: Controles */}
          <div className="space-y-6">
            {/* Cenário Anatômico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cenário Anatômico</CardTitle>
                <CardDescription>
                  Selecione o cenário anatômico para o laboratório
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Cenário</Label>
                  <Select 
                    value={scenario} 
                    onValueChange={(v) => {
                      const newScenario = v as AnatomicalScenario;
                      setScenario(newScenario);
                      // Initialize customThicknesses when switching to custom
                      if (newScenario === "custom" && !config.customThicknesses) {
                        updateConfig({ 
                          scenario: newScenario,
                          customThicknesses: {
                            skin: 0.2,
                            fat: 0.5,
                            muscle: 2.0,
                          }
                        });
                      } else {
                        updateConfig({ scenario: newScenario });
                      }
                    }}
                    disabled={!config.enabledControls.scenario}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shoulder">Ombro (tendão/bursa)</SelectItem>
                      <SelectItem value="knee">Joelho (tendão/ligamento)</SelectItem>
                      <SelectItem value="lumbar">Lombar (musculatura)</SelectItem>
                      <SelectItem value="forearm">Antebraço (superficial)</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controles de Camadas Personalizadas (STACK MODEL) */}
                {scenario === "custom" && config.enabledControls.customThicknesses !== false && (
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-sm font-medium">Configuração de Camadas (STACK)</Label>
                    <p className="text-xs text-muted-foreground">
                      As camadas são empilhadas: cada camada empurra as camadas abaixo
                    </p>
                    
                    {(() => {
                      const skin = config.customThicknesses?.skin || 0.2;
                      const fat = config.customThicknesses?.fat || 0.5;
                      const muscle = config.customThicknesses?.muscle || 2.0;
                      const TOTAL_BLOCK_DEPTH = 6.0;
                      
                      // Calcular posições cumulativas (STACK)
                      const skinEnd = skin;
                      const fatEnd = skinEnd + fat;
                      const muscleEnd = fatEnd + muscle;
                      const boneStart = muscleEnd; // Osso sempre começa onde músculo termina
                      const boneThickness = Math.max(0, TOTAL_BLOCK_DEPTH - boneStart);
                      
                      return (
                        <div className="space-y-4">
                          {/* Pele */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-sm">Pele</Label>
                              <span className="text-sm font-mono text-muted-foreground">
                                {skin.toFixed(2)} cm
                              </span>
                            </div>
                            <Slider
                              value={[skin]}
                              onValueChange={(v) => updateConfig({ 
                                customThicknesses: { 
                                  ...config.customThicknesses,
                                  skin: v[0],
                                  fat: config.customThicknesses?.fat || 0.5,
                                  muscle: config.customThicknesses?.muscle || 2.0,
                                } 
                              })}
                              min={config.ranges.customThicknesses?.skin.min || 0.1}
                              max={config.ranges.customThicknesses?.skin.max || 0.5}
                              step={0.05}
                            />
                            <p className="text-xs text-muted-foreground">
                              Início: 0.00 cm | Fim: {skinEnd.toFixed(2)} cm
                            </p>
                          </div>

                          {/* Gordura */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-sm">Gordura</Label>
                              <span className="text-sm font-mono text-muted-foreground">
                                {fat.toFixed(2)} cm
                              </span>
                            </div>
                            <Slider
                              value={[fat]}
                              onValueChange={(v) => updateConfig({ 
                                customThicknesses: { 
                                  ...config.customThicknesses,
                                  skin: config.customThicknesses?.skin || 0.2,
                                  fat: v[0],
                                  muscle: config.customThicknesses?.muscle || 2.0,
                                } 
                              })}
                              min={config.ranges.customThicknesses?.fat.min || 0.1}
                              max={config.ranges.customThicknesses?.fat.max || 2.0}
                              step={0.1}
                            />
                            <p className="text-xs text-muted-foreground">
                              Início: {skinEnd.toFixed(2)} cm | Fim: {fatEnd.toFixed(2)} cm
                            </p>
                          </div>

                          {/* Músculo */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-sm">Músculo</Label>
                              <span className="text-sm font-mono text-muted-foreground">
                                {muscle.toFixed(2)} cm
                              </span>
                            </div>
                            <Slider
                              value={[muscle]}
                              onValueChange={(v) => updateConfig({ 
                                customThicknesses: { 
                                  ...config.customThicknesses,
                                  skin: config.customThicknesses?.skin || 0.2,
                                  fat: config.customThicknesses?.fat || 0.5,
                                  muscle: v[0],
                                } 
                              })}
                              min={config.ranges.customThicknesses?.muscle.min || 0.5}
                              max={config.ranges.customThicknesses?.muscle.max || 5.0}
                              step={0.1}
                            />
                            <p className="text-xs text-muted-foreground">
                              Início: {fatEnd.toFixed(2)} cm | Fim: {muscleEnd.toFixed(2)} cm
                            </p>
                            {muscleEnd > TOTAL_BLOCK_DEPTH && (
                              <p className="text-xs text-amber-400">
                                ⚠️ Soma excede o volume. Músculo será ajustado automaticamente.
                              </p>
                            )}
                          </div>

                          {/* Métrica: Início do Osso (read-only) */}
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex justify-between items-center">
                              <Label className="text-sm">Início do Osso (calculado)</Label>
                              <span className="text-sm font-mono font-bold text-primary">
                                {boneStart.toFixed(2)} cm
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              O osso sempre começa onde o músculo termina (STACK model)
                            </p>
                            {boneThickness > 0.01 && (
                              <p className="text-xs text-muted-foreground">
                                Espessura do osso: {boneThickness.toFixed(2)} cm (preenche até {TOTAL_BLOCK_DEPTH.toFixed(1)} cm)
                              </p>
                            )}
                            {boneThickness <= 0.01 && (
                              <p className="text-xs text-amber-400">
                                ⚠️ Não há espaço para osso. Aumente o volume ou reduza as camadas acima.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parâmetros de Transdutor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parâmetros de Transdutor</CardTitle>
                <CardDescription>
                  Ajuste para testar o laboratório
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.enabledControls.frequency && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Frequência</Label>
                      <span className="text-sm font-bold text-primary">{frequency.toFixed(1)} MHz</span>
                    </div>
                    <Slider
                      value={[frequency]}
                      onValueChange={(v) => setFrequency(v[0])}
                      min={config.ranges.frequency.min}
                      max={config.ranges.frequency.max}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {frequency <= 1.5 ? "Penetração profunda" : "Penetração superficial"}
                    </p>
                  </div>
                )}

                {config.enabledControls.era && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>ERA (Área Efetiva)</Label>
                      <span className="text-sm font-bold text-primary">{era.toFixed(1)} cm²</span>
                    </div>
                    <Slider
                      value={[era]}
                      onValueChange={(v) => setEra(v[0])}
                      min={config.ranges.era.min}
                      max={config.ranges.era.max}
                      step={0.5}
                    />
                  </div>
                )}

                {config.enabledControls.mode && (
                  <div>
                    <Label className="mb-3 block">Modo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={mode === "continuous" ? "default" : "outline"}
                        onClick={() => setMode("continuous")}
                        size="sm"
                      >
                        Contínuo
                      </Button>
                      <Button
                        variant={mode === "pulsed" ? "default" : "outline"}
                        onClick={() => setMode("pulsed")}
                        size="sm"
                      >
                        Pulsado
                      </Button>
                    </div>
                  </div>
                )}

                {config.enabledControls.dutyCycle && mode === "pulsed" && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Duty Cycle</Label>
                      <span className="text-sm font-bold text-primary">{dutyCycle}%</span>
                    </div>
                    <Slider
                      value={[dutyCycle]}
                      onValueChange={(v) => setDutyCycle(v[0])}
                      min={config.ranges.dutyCycle.min}
                      max={config.ranges.dutyCycle.max}
                      step={5}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parâmetros de Energia */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parâmetros de Energia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.enabledControls.intensity && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Intensidade</Label>
                      <span className="text-sm font-bold text-primary">{intensity.toFixed(1)} W/cm²</span>
                    </div>
                    <Slider
                      value={[intensity]}
                      onValueChange={(v) => setIntensity(v[0])}
                      min={config.ranges.intensity.min}
                      max={config.ranges.intensity.max}
                      step={0.1}
                    />
                  </div>
                )}

                {config.enabledControls.duration && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Duração</Label>
                      <span className="text-sm font-bold text-primary">{duration} min</span>
                    </div>
                    <Slider
                      value={[duration]}
                      onValueChange={(v) => setDuration(v[0])}
                      min={config.ranges.duration.min}
                      max={config.ranges.duration.max}
                      step={1}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Técnica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Técnica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.enabledControls.coupling && (
                  <div>
                    <Label className="mb-3 block">Acoplamento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={coupling === "good" ? "default" : "outline"}
                        onClick={() => setCoupling("good")}
                        size="sm"
                      >
                        Bom
                      </Button>
                      <Button
                        variant={coupling === "poor" ? "default" : "outline"}
                        onClick={() => setCoupling("poor")}
                        size="sm"
                      >
                        Ruim
                      </Button>
                    </div>
                  </div>
                )}

                {config.enabledControls.movement && (
                  <div>
                    <Label className="mb-3 block">Movimento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={movement === "stationary" ? "default" : "outline"}
                        onClick={() => setMovement("stationary")}
                        size="sm"
                      >
                        Parado
                      </Button>
                      <Button
                        variant={movement === "scanning" ? "default" : "outline"}
                        onClick={() => setMovement("scanning")}
                        size="sm"
                      >
                        Varredura
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* COLUNA 2: Preview */}
          <div className="w-full flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <UltrasoundTherapyLabPreview
              config={config}
              scenario={scenario}
              frequency={frequency}
              intensity={intensity}
              era={era}
              mode={mode}
              dutyCycle={dutyCycle}
              duration={duration}
              coupling={coupling}
              movement={movement}
            />
          </div>
        </div>
      </TabsContent>

      {/* Tab 2: Controles Disponíveis */}
      <TabsContent value="controls" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Controles Disponíveis</CardTitle>
            <CardDescription>
              Selecione quais parâmetros o aluno poderá ajustar durante o laboratório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-scenario" className="flex flex-col gap-1">
                <span className="font-medium">Cenário Anatômico</span>
                <span className="text-sm text-muted-foreground">
                  Permite selecionar o cenário anatômico
                </span>
              </Label>
              <Switch
                id="enable-scenario"
                checked={config.enabledControls.scenario}
                onCheckedChange={(checked) => updateEnabledControls("scenario", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-frequency" className="flex flex-col gap-1">
                <span className="font-medium">Frequência</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a frequência (MHz)
                </span>
              </Label>
              <Switch
                id="enable-frequency"
                checked={config.enabledControls.frequency}
                onCheckedChange={(checked) => updateEnabledControls("frequency", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-era" className="flex flex-col gap-1">
                <span className="font-medium">ERA (Área Efetiva)</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a área efetiva (cm²)
                </span>
              </Label>
              <Switch
                id="enable-era"
                checked={config.enabledControls.era}
                onCheckedChange={(checked) => updateEnabledControls("era", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-mode" className="flex flex-col gap-1">
                <span className="font-medium">Modo</span>
                <span className="text-sm text-muted-foreground">
                  Permite alternar entre contínuo e pulsado
                </span>
              </Label>
              <Switch
                id="enable-mode"
                checked={config.enabledControls.mode}
                onCheckedChange={(checked) => updateEnabledControls("mode", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-duty-cycle" className="flex flex-col gap-1">
                <span className="font-medium">Duty Cycle</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar o duty cycle quando pulsado (%)
                </span>
              </Label>
              <Switch
                id="enable-duty-cycle"
                checked={config.enabledControls.dutyCycle}
                onCheckedChange={(checked) => updateEnabledControls("dutyCycle", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-intensity" className="flex flex-col gap-1">
                <span className="font-medium">Intensidade</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a intensidade (W/cm²)
                </span>
              </Label>
              <Switch
                id="enable-intensity"
                checked={config.enabledControls.intensity}
                onCheckedChange={(checked) => updateEnabledControls("intensity", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-duration" className="flex flex-col gap-1">
                <span className="font-medium">Duração</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a duração da sessão (min)
                </span>
              </Label>
              <Switch
                id="enable-duration"
                checked={config.enabledControls.duration}
                onCheckedChange={(checked) => updateEnabledControls("duration", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-coupling" className="flex flex-col gap-1">
                <span className="font-medium">Acoplamento</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar a qualidade do acoplamento
                </span>
              </Label>
              <Switch
                id="enable-coupling"
                checked={config.enabledControls.coupling}
                onCheckedChange={(checked) => updateEnabledControls("coupling", checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="enable-movement" className="flex flex-col gap-1">
                <span className="font-medium">Movimento</span>
                <span className="text-sm text-muted-foreground">
                  Permite ajustar o movimento do transdutor
                </span>
              </Label>
              <Switch
                id="enable-movement"
                checked={config.enabledControls.movement}
                onCheckedChange={(checked) => updateEnabledControls("movement", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Limites dos Parâmetros */}
        <Card>
          <CardHeader>
            <CardTitle>Limites dos Parâmetros</CardTitle>
            <CardDescription>
              Defina os valores mínimos e máximos permitidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequência Mínima (MHz)</Label>
                <Input
                  type="number"
                  value={config.ranges.frequency.min}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      frequency: {
                        ...config.ranges.frequency,
                        min: Number(e.target.value) || 1,
                      },
                    },
                  })}
                  step={0.1}
                />
              </div>
              <div>
                <Label>Frequência Máxima (MHz)</Label>
                <Input
                  type="number"
                  value={config.ranges.frequency.max}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      frequency: {
                        ...config.ranges.frequency,
                        max: Number(e.target.value) || 3,
                      },
                    },
                  })}
                  step={0.1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ERA Mínima (cm²)</Label>
                <Input
                  type="number"
                  value={config.ranges.era.min}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      era: {
                        ...config.ranges.era,
                        min: Number(e.target.value) || 3,
                      },
                    },
                  })}
                  step={0.5}
                />
              </div>
              <div>
                <Label>ERA Máxima (cm²)</Label>
                <Input
                  type="number"
                  value={config.ranges.era.max}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      era: {
                        ...config.ranges.era,
                        max: Number(e.target.value) || 10,
                      },
                    },
                  })}
                  step={0.5}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Intensidade Mínima (W/cm²)</Label>
                <Input
                  type="number"
                  value={config.ranges.intensity.min}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      intensity: {
                        ...config.ranges.intensity,
                        min: Number(e.target.value) || 0.1,
                      },
                    },
                  })}
                  step={0.1}
                />
              </div>
              <div>
                <Label>Intensidade Máxima (W/cm²)</Label>
                <Input
                  type="number"
                  value={config.ranges.intensity.max}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      intensity: {
                        ...config.ranges.intensity,
                        max: Number(e.target.value) || 2.5,
                      },
                    },
                  })}
                  step={0.1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duração Mínima (min)</Label>
                <Input
                  type="number"
                  value={config.ranges.duration.min}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      duration: {
                        ...config.ranges.duration,
                        min: Number(e.target.value) || 1,
                      },
                    },
                  })}
                  step={1}
                />
              </div>
              <div>
                <Label>Duração Máxima (min)</Label>
                <Input
                  type="number"
                  value={config.ranges.duration.max}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      duration: {
                        ...config.ranges.duration,
                        max: Number(e.target.value) || 20,
                      },
                    },
                  })}
                  step={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duty Cycle Mínimo (%)</Label>
                <Input
                  type="number"
                  value={config.ranges.dutyCycle.min}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      dutyCycle: {
                        ...config.ranges.dutyCycle,
                        min: Number(e.target.value) || 10,
                      },
                    },
                  })}
                  step={5}
                />
              </div>
              <div>
                <Label>Duty Cycle Máximo (%)</Label>
                <Input
                  type="number"
                  value={config.ranges.dutyCycle.max}
                  onChange={(e) => updateConfig({
                    ranges: {
                      ...config.ranges,
                      dutyCycle: {
                        ...config.ranges.dutyCycle,
                        max: Number(e.target.value) || 100,
                      },
                    },
                  })}
                  step={5}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
