import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";

export function SimulationResourcesSection() {
  const { simulationFeatures, setSimulationFeatures } = useUltrasoundLabStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recursos da Simulação</CardTitle>
        <CardDescription>
          Configure os artefatos, efeitos e recursos visuais da simulação de ultrassom
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Artefatos Acústicos */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Artefatos Acústicos</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reforço Posterior</Label>
                  <p className="text-xs text-muted-foreground">
                    Intensificação posterior a estruturas anecoicas (cistos, líquidos)
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.enablePosteriorEnhancement}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ enablePosteriorEnhancement: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sombra Acústica</Label>
                  <p className="text-xs text-muted-foreground">
                    Sombra posterior a estruturas altamente atenuantes (ossos, calcificações)
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.enableAcousticShadow}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ enableAcousticShadow: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reverberação</Label>
                  <p className="text-xs text-muted-foreground">
                    Artefatos de múltiplas reflexões entre interfaces paralelas
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.enableReverberation}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ enableReverberation: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clutter de Campo Próximo</Label>
                  <p className="text-xs text-muted-foreground">
                    Ruído e artefatos característicos da região superficial
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.enableNearFieldClutter}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ enableNearFieldClutter: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Overlays Visuais */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Overlays Visuais</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Overlay do Feixe</Label>
                  <p className="text-xs text-muted-foreground">
                    Visualização do formato e divergência do feixe ultrassônico
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showBeamOverlay}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showBeamOverlay: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Escala de Profundidade</Label>
                  <p className="text-xs text-muted-foreground">
                    Marcações de profundidade em centímetros na lateral da imagem
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showDepthScale}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showDepthScale: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Marcador de Foco</Label>
                  <p className="text-xs text-muted-foreground">
                    Indicação visual da zona focal do transdutor
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showFocusMarker}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showFocusMarker: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Linhas de Campo</Label>
                  <p className="text-xs text-muted-foreground">
                    Visualização das linhas do campo acústico
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showFieldLines}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showFieldLines: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Rótulos Anatômicos</Label>
                  <p className="text-xs text-muted-foreground">
                    Identificação das estruturas anatômicas na imagem
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showAnatomyLabels}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showAnatomyLabels: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recursos Avançados */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Recursos Avançados</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Painel de Física</Label>
                  <p className="text-xs text-muted-foreground">
                    Exibir propriedades físicas e parâmetros de simulação em tempo real
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showPhysicsPanel}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showPhysicsPanel: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mapa de Atenuação</Label>
                  <p className="text-xs text-muted-foreground">
                    Visualização colorida da atenuação do sinal em profundidade
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.showAttenuationMap}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ showAttenuationMap: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Doppler Colorido</Label>
                  <p className="text-xs text-muted-foreground">
                    Ativar modo Doppler colorido para visualização de fluxo sanguíneo
                  </p>
                </div>
                <Switch
                  checked={simulationFeatures.enableColorDoppler}
                  onCheckedChange={(checked) =>
                    setSimulationFeatures({ enableColorDoppler: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
