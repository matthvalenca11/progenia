import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { Sliders, Lock, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const StudentControlsSection = () => {
  const { studentControls, setStudentControls } = useUltrasoundLabStore();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders className="h-5 w-5" />
          Controles Disponíveis ao Estudante
        </CardTitle>
        <CardDescription>
          Defina quais controles o estudante poderá manipular no laboratório
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-3 rounded-lg flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Oculte controles para focar o estudante em conceitos específicos. Por exemplo, ao ensinar atenuação, mostre apenas frequência e profundidade.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Controles de Imagem</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-gain">Ganho (Brilho)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Permite ajustar o brilho geral da imagem
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <Switch
                  id="lock-gain"
                  checked={studentControls.lockGain}
                  onCheckedChange={(checked) => 
                    setStudentControls({ lockGain: checked })
                  }
                />
              </div>
              <Switch
                id="show-gain"
                checked={studentControls.showGain}
                onCheckedChange={(checked) => 
                  setStudentControls({ showGain: checked })
                }
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-depth">Profundidade</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Controle de zoom / alcance de visualização
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <Switch
                  id="lock-depth"
                  checked={studentControls.lockDepth}
                  onCheckedChange={(checked) => 
                    setStudentControls({ lockDepth: checked })
                  }
                />
              </div>
              <Switch
                id="show-depth"
                checked={studentControls.showDepth}
                onCheckedChange={(checked) => 
                  setStudentControls({ showDepth: checked })
                }
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-frequency">Frequência (MHz)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Frequência do transdutor - afeta penetração e resolução
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <Switch
                  id="lock-frequency"
                  checked={studentControls.lockFrequency}
                  onCheckedChange={(checked) => 
                    setStudentControls({ lockFrequency: checked })
                  }
                />
              </div>
              <Switch
                id="show-frequency"
                checked={studentControls.showFrequency}
                onCheckedChange={(checked) => 
                  setStudentControls({ showFrequency: checked })
                }
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-focus">Foco</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Profundidade da zona focal com máxima resolução
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <Switch
                  id="lock-focus"
                  checked={studentControls.lockFocus}
                  onCheckedChange={(checked) => 
                    setStudentControls({ lockFocus: checked })
                  }
                />
              </div>
              <Switch
                id="show-focus"
                checked={studentControls.showFocus}
                onCheckedChange={(checked) => 
                  setStudentControls({ showFocus: checked })
                }
              />
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Seletor de Equipamento</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-transducer">Seletor de transdutor</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Permite trocar entre Linear, Convexo e Microconvexo
              </p>
            </div>
            <Switch
              id="show-transducer"
              checked={studentControls.showTransducerSelector}
              onCheckedChange={(checked) => 
                setStudentControls({ showTransducerSelector: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-mode">Seletor de modo de imagem</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Permite trocar entre Modo B e Doppler Color
              </p>
            </div>
            <Switch
              id="show-mode"
              checked={studentControls.showModeSelector}
              onCheckedChange={(checked) => 
                setStudentControls({ showModeSelector: checked })
              }
            />
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Simulação de Movimento</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="enable-movement">Movimento do transdutor</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Permite simular movimento lateral do transdutor com setas (inclusões se deslocam)
              </p>
            </div>
            <Switch
              id="enable-movement"
              checked={studentControls.enableTransducerMovement}
              onCheckedChange={(checked) => 
                setStudentControls({ enableTransducerMovement: checked })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
