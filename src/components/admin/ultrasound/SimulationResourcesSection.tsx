import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { ComplexityLevel } from "@/types/ultrasoundAdvanced";
import { Info, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function SimulationResourcesSection() {
  const { 
    complexityLevel, 
    simulationFeatures, 
    setComplexityLevel, 
    setSimulationFeatures 
  } = useUltrasoundLabStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Recursos da Simulação
        </CardTitle>
        <CardDescription>
          Configure o que será simulado e exibido aos estudantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Complexity Level Selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Nível de Complexidade</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pré-configura recursos baseado no nível desejado. Você pode ajustar individualmente depois.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select value={complexityLevel} onValueChange={(value) => setComplexityLevel(value as ComplexityLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basico">Básico - Conceitos fundamentais</SelectItem>
              <SelectItem value="intermediario">Intermediário - Física e artefatos</SelectItem>
              <SelectItem value="avancado">Avançado - Simulação completa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Separator />
        
        {/* Visualização Básica */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Visualização Básica</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="structural-bmode">Imagem estrutural (Modo B básico)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Renderização da textura ultrassonográfica com base nas camadas
                </p>
              </div>
              <Switch
                id="structural-bmode"
                checked={simulationFeatures.showStructuralBMode}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showStructuralBMode: checked })
                }
              />
            </div>
          </div>
        </div>
        
        <Separator />

        {/* Artefatos Acústicos */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Artefatos de Imagem</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="posterior-enhancement">Reforço posterior (posterior enhancement)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Aumento de brilho posterior a estruturas anecoicas (cistos)
                </p>
              </div>
              <Switch
                id="posterior-enhancement"
                checked={simulationFeatures.enablePosteriorEnhancement}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ enablePosteriorEnhancement: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="acoustic-shadow">Sombra acústica</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Sombra escura posterior a estruturas altamente refletoras (osso, calcificação)
                </p>
              </div>
              <Switch
                id="acoustic-shadow"
                checked={simulationFeatures.enableAcousticShadow}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ enableAcousticShadow: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="reverberation">Reverberação</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Artefato de múltiplas reflexões entre estruturas
                </p>
              </div>
              <Switch
                id="reverberation"
                checked={simulationFeatures.enableReverberation}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ enableReverberation: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="near-field-clutter">Ruído de campo próximo</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Excesso de noise nos primeiros centímetros
                </p>
              </div>
              <Switch
                id="near-field-clutter"
                checked={simulationFeatures.enableNearFieldClutter}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ enableNearFieldClutter: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Elementos de Orientação */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Elementos de Orientação</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="beam-overlay">Visualização do feixe de ultrassom</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Mostra linhas do feixe acústico partindo do transdutor
                </p>
              </div>
              <Switch
                id="beam-overlay"
                checked={simulationFeatures.showBeamOverlay}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showBeamOverlay: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="depth-scale">Escala de profundidade (cm)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Marcadores de profundidade na lateral da imagem
                </p>
              </div>
              <Switch
                id="depth-scale"
                checked={simulationFeatures.showDepthScale}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showDepthScale: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="focus-marker">Indicador de foco</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Triângulo amarelo mostrando a zona focal na escala
                </p>
              </div>
              <Switch
                id="focus-marker"
                checked={simulationFeatures.showFocusMarker}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showFocusMarker: checked })
                }
              />
            </div>
          </div>
        </div>
        
        <Separator />

        {/* Overlays Didáticos */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Overlays Didáticos</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="field-lines">Linhas de propagação do campo</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Arcos concêntricos representando a propagação da onda
                </p>
              </div>
              <Switch
                id="field-lines"
                checked={simulationFeatures.showFieldLines}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showFieldLines: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="attenuation-map">Mapa de atenuação</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Overlay mostrando decaimento da intensidade com profundidade
                </p>
              </div>
              <Switch
                id="attenuation-map"
                checked={simulationFeatures.showAttenuationMap}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showAttenuationMap: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="anatomy-labels">Labels anatômicos</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Textos identificando camadas (Pele, Gordura, Músculo...)
                </p>
              </div>
              <Switch
                id="anatomy-labels"
                checked={simulationFeatures.showAnatomyLabels}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showAnatomyLabels: checked })
                }
              />
            </div>
          </div>
        </div>
        
        <Separator />

        {/* Recursos Avançados */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Recursos Avançados</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="physics-panel">Painel de parâmetros físicos</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Exibe potência, energia, dose e classificação em tempo real
                </p>
              </div>
              <Switch
                id="physics-panel"
                checked={simulationFeatures.showPhysicsPanel}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ showPhysicsPanel: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="color-doppler">Ativar Doppler Color</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Renderiza fluxo sanguíneo em azul/vermelho (quando há vasos na anatomia)
                </p>
              </div>
              <Switch
                id="color-doppler"
                checked={simulationFeatures.enableColorDoppler}
                onCheckedChange={(checked) => 
                  setSimulationFeatures({ enableColorDoppler: checked })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
