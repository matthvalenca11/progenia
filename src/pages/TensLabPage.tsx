import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tens3DSimulator } from "@/components/labs/tens3d/Tens3DSimulator";
import { TensInsightsPanel } from "@/components/labs/TensInsightsPanel";
import { TissuePresetSelector } from "@/components/admin/TissuePresetSelector";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { Activity, ArrowLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig, defaultTissueConfig, tissuePresets, TissuePresetId } from "@/types/tissueConfig";
import { tissueConfigService } from "@/services/tissueConfigService";

interface TensLabPageProps {
  config?: TensLabConfig;
  previewMode?: boolean;
}

export default function TensLabPage({ config = defaultTensLabConfig, previewMode = false }: TensLabPageProps) {
  const navigate = useNavigate();
  
  // Estado centralizado de tissue config - SINGLE SOURCE OF TRUTH
  const [selectedPresetId, setSelectedPresetId] = useState<TissuePresetId>(() => {
    const presetId = config.tissueConfigId;
    const preset = tissuePresets.find(p => p.id === presetId);
    return preset ? preset.id : "forearm_slim";
  });
  const [tissueConfig, setTissueConfig] = useState<TissueConfig>(() => ({
    ...defaultTissueConfig,
    inclusions: [],
  }));
  
  // Carregar tissue config inicial
  useEffect(() => {
    const loadTissueConfig = async () => {
      if (config.tissueConfigId) {
        // Primeiro verifica se é um preset ID
        const preset = tissuePresets.find(p => p.id === config.tissueConfigId);
        
        if (preset && !preset.isCustom) {
          // É um preset predefinido, usar config do preset
          setSelectedPresetId(preset.id);
          setTissueConfig({
            ...preset.config,
            id: preset.id,
          });
        } else {
          // Tentar carregar do banco (pode ser custom ou uma config salva)
          try {
            const loaded = await tissueConfigService.getById(config.tissueConfigId);
            if (loaded) {
              setTissueConfig(loaded);
              setSelectedPresetId("custom");
            }
          } catch (error) {
            console.error("Error loading tissue config:", error);
          }
        }
      }
    };
    
    loadTissueConfig();
  }, [config.tissueConfigId]);
  
  // Atualizar tissueConfig quando preset mudar
  const handlePresetChange = (presetId: TissuePresetId) => {
    setSelectedPresetId(presetId);
    
    if (presetId !== "custom") {
      const preset = tissuePresets.find(p => p.id === presetId);
      if (preset) {
        setTissueConfig({
          ...preset.config,
          id: preset.id,
        });
      }
    }
    // Se for custom, mantém o tissueConfig atual
  };
  
  // Atualizar tissueConfig diretamente (usado no modo custom)
  const handleCustomConfigChange = (config: TissueConfig) => {
    console.log('🔧 handleCustomConfigChange CALLED with config:', {
      skinThickness: config.skinThickness,
      fatThickness: config.fatThickness,
      muscleThickness: config.muscleThickness,
      boneDepth: config.boneDepth,
      hasMetalImplant: config.hasMetalImplant,
      inclusionsCount: config.inclusions?.length || 0,
    });
    console.log('🔧 Current tissueConfig state BEFORE update:', tissueConfig);
    const newConfig = { ...config }; // Nova referência para forçar re-render
    setTissueConfig(newConfig);
    console.log('✅ setTissueConfig CALLED with newConfig:', newConfig);
  };
  
  // Estados dos parâmetros com valores iniciais baseados na config
  const [frequency, setFrequency] = useState(
    Math.min(80, config.frequencyRange.max, Math.max(config.frequencyRange.min, 80))
  );
  const [pulseWidth, setPulseWidth] = useState(
    Math.min(200, config.pulseWidthRange.max, Math.max(config.pulseWidthRange.min, 200))
  );
  const [intensity, setIntensity] = useState(
    Math.min(20, config.intensityRange.max, Math.max(config.intensityRange.min, 20))
  );
  const [mode, setMode] = useState<TensMode>(
    config.allowedModes[0] || "convencional"
  );

  // Simulação em tempo real
  const sim = useMemo(() => 
    simulateTens({
      frequencyHz: frequency,
      pulseWidthUs: pulseWidth,
      intensitymA: intensity,
      mode,
    }), 
    [frequency, pulseWidth, intensity, mode]
  );
  
  // Simulação de risco em tempo real
  const riskResult = useMemo(() => 
    simulateTissueRisk(
      {
        frequencyHz: frequency,
        pulseWidthUs: pulseWidth,
        intensitymA: intensity,
        mode,
      },
      tissueConfig
    ),
    [frequency, pulseWidth, intensity, mode, tissueConfig]
  );


  return (
    <div className={previewMode ? "bg-background p-4" : "min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8"}>
      <div className={previewMode ? "w-full" : "max-w-7xl mx-auto"}>
        {/* Header com botão de voltar */}
        {!previewMode && (
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-8 w-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Laboratório Virtual de Eletroterapia – TENS
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Ajuste os parâmetros do equipamento TENS (estimulação elétrica transcutânea) e visualize, 
              em tempo real, os efeitos simulados da estimulação entre os eletrodos. 
              Experimente diferentes configurações para compreender como cada parâmetro influencia a terapia.
            </p>
          </div>
        )}

        {/* Layout principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 - Controles */}
          <div className="space-y-6">
            {/* Seletor de Cenário Anatômico */}
            <TissuePresetSelector
              selectedPresetId={selectedPresetId}
              tissueConfig={tissueConfig}
              onPresetChange={handlePresetChange}
              onCustomConfigChange={handleCustomConfigChange}
            />
            {/* Card de Controles Principais */}
            {(config.enabledControls.frequency || config.enabledControls.pulseWidth || config.enabledControls.intensity) && (
              <Card className="p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Parâmetros de Estimulação
                </h2>
                
                <div className="space-y-8">
                  {/* Frequência */}
                  {config.enabledControls.frequency && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-medium">Frequência</Label>
                        <span className="text-lg font-bold text-primary">
                          {frequency} <span className="text-sm font-normal text-muted-foreground">Hz</span>
                        </span>
                      </div>
                      <Slider
                        value={[frequency]}
                        onValueChange={(v) => setFrequency(v[0])}
                        min={config.frequencyRange.min}
                        max={config.frequencyRange.max}
                        step={1}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{config.frequencyRange.min} Hz</span>
                        <span>{config.frequencyRange.max} Hz</span>
                      </div>
                    </div>
                  )}

                  {/* Largura de Pulso */}
                  {config.enabledControls.pulseWidth && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-medium">Largura de Pulso</Label>
                        <span className="text-lg font-bold text-primary">
                          {pulseWidth} <span className="text-sm font-normal text-muted-foreground">µs</span>
                        </span>
                      </div>
                      <Slider
                        value={[pulseWidth]}
                        onValueChange={(v) => setPulseWidth(v[0])}
                        min={config.pulseWidthRange.min}
                        max={config.pulseWidthRange.max}
                        step={10}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{config.pulseWidthRange.min} µs</span>
                        <span>{config.pulseWidthRange.max} µs</span>
                      </div>
                    </div>
                  )}

                  {/* Intensidade */}
                  {config.enabledControls.intensity && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-medium">Intensidade</Label>
                        <span className="text-lg font-bold text-primary">
                          {intensity} <span className="text-sm font-normal text-muted-foreground">mA</span>
                        </span>
                      </div>
                      <Slider
                        value={[intensity]}
                        onValueChange={(v) => setIntensity(v[0])}
                        min={config.intensityRange.min}
                        max={config.intensityRange.max}
                        step={1}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{config.intensityRange.min} mA</span>
                        <span>{config.intensityRange.max} mA</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Modo TENS */}
            {config.enabledControls.mode && config.allowedModes.length > 0 && (
              <Card className="p-6 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Modo de Estimulação</h3>
                <div className="grid grid-cols-2 gap-3">
                  {config.allowedModes.map((m) => (
                    <Button
                      key={m}
                      variant={mode === m ? "default" : "outline"}
                      onClick={() => setMode(m)}
                      className="capitalize h-auto py-3"
                    >
                      {m}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {mode === "convencional" && "Estimulação contínua de alta frequência (50-100 Hz) para alívio de dor aguda através da teoria das comportas."}
                    {mode === "acupuntura" && "Baixa frequência (2-10 Hz) com pulsos longos para liberação de endorfinas e alívio de dor crônica."}
                    {mode === "burst" && "Grupos de pulsos de alta frequência entregues em baixa frequência de repetição, combinando efeitos sensoriais e motores."}
                    {mode === "modulado" && "Amplitude modulada para prevenir acomodação sensorial e manter eficácia ao longo do tempo."}
                  </p>
                </div>
              </Card>
            )}

          </div>

          {/* Coluna 2 - Preview Anatômico 2D Central */}
          <div className="space-y-6">
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Preview da Anatomia
                </CardTitle>
                <CardDescription>
                  Visualização em tempo real das camadas anatômicas configuradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] rounded-lg overflow-hidden">
                  <TensSemi3DView
                    frequencyHz={frequency}
                    pulseWidthUs={pulseWidth}
                    intensitymA={intensity}
                    mode={mode}
                    activationLevel={sim.activationLevel}
                    comfortLevel={sim.comfortLevel}
                    tissueConfig={tissueConfig}
                    riskResult={riskResult}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 3 - Simulador 3D Biomédico */}
          <div className="space-y-6">
            <Card className="shadow-lg border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
                  Simulador 3D Biomédico
                </CardTitle>
                <CardDescription>
                  Modelo fisiológico tridimensional com campo elétrico e análise de riscos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tens3DSimulator
                  frequencyHz={frequency}
                  pulseWidthUs={pulseWidth}
                  intensitymA={intensity}
                  mode={mode}
                  activationLevel={sim.activationLevel}
                  comfortLevel={sim.comfortLevel}
                  tissueConfig={tissueConfig}
                  riskResult={riskResult}
                  compact={previewMode}
                />
              </CardContent>
            </Card>


            {/* Painel Unificado de Insights */}
            <TensInsightsPanel
              showFeedback={config.showFeedbackSection ?? config.showComfortCard}
              showRisk={config.showRiskSection ?? true}
              showWaveform={config.showWaveformSection ?? config.showWaveform}
              feedbackData={{
                comfortLevel: sim.comfortLevel,
                activationLevel: sim.activationLevel,
                comfortMessage: sim.comfortMessage,
              }}
              riskData={riskResult}
              waveformData={{
                frequency,
                pulseWidth,
                intensity,
                mode,
              }}
              enableRiskSimulation={tissueConfig.enableRiskSimulation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
