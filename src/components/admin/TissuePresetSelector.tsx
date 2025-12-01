import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { TissueConfig, tissuePresets, TissuePresetId } from "@/types/tissueConfig";
import { TensInclusionsEditor } from "./TensInclusionsEditor";
import { Settings2 } from "lucide-react";

interface TissuePresetSelectorProps {
  selectedPresetId: TissuePresetId;
  tissueConfig: TissueConfig; // Estado ativo atual
  onPresetChange: (presetId: TissuePresetId) => void;
  onCustomConfigChange: (config: TissueConfig) => void;
}

export function TissuePresetSelector({
  selectedPresetId,
  tissueConfig, // Agora usa apenas o tissueConfig ativo
  onPresetChange,
  onCustomConfigChange,
}: TissuePresetSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempSelectedId, setTempSelectedId] = useState<TissuePresetId>(selectedPresetId);
  
  const selectedPreset = tissuePresets.find(p => p.id === selectedPresetId);
  const isCustom = selectedPresetId === "custom";

  const updateCustomConfig = (updates: Partial<TissueConfig>) => {
    console.log('📝 updateCustomConfig called with:', updates);
    // Criar nova referência completa para garantir re-render
    const newConfig = { 
      ...tissueConfig, // Usar tissueConfig atual ao invés de customConfig
      ...updates,
      // Garantir que inclusions é sempre um array
      inclusions: updates.inclusions !== undefined ? updates.inclusions : (tissueConfig.inclusions || [])
    };
    console.log('📤 Sending newConfig to onCustomConfigChange:', newConfig);
    onCustomConfigChange(newConfig);
  };
  
  const handleApplyPreset = () => {
    onPresetChange(tempSelectedId);
    setDialogOpen(false);
  };
  
  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setTempSelectedId(selectedPresetId);
    }
    setDialogOpen(open);
  };

  return (
    <div className="space-y-6">
      {/* Resumo Compacto + Botão para abrir Dialog */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Cenário anatômico selecionado
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {selectedPreset?.label}
              {isCustom && (
                <span className="ml-2 inline-flex px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  ✏️ Personalizado
                </span>
              )}
              {selectedPreset?.config.hasMetalImplant && !isCustom && (
                <span className="ml-2 inline-flex px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                  ⚡ Implante
                </span>
              )}
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <Settings2 className="h-4 w-4 mr-2" />
                Alterar cenário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Escolher cenário anatômico</DialogTitle>
                <DialogDescription>
                  Selecione um preset predefinido ou configure manualmente as camadas de tecido
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tissuePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setTempSelectedId(preset.id)}
                      className={`
                        w-full h-24 p-3 rounded-xl border shadow-sm overflow-hidden
                        transition-all duration-200
                        ${tempSelectedId === preset.id 
                          ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                          : 'bg-card hover:bg-accent hover:border-accent-foreground/20'
                        }
                      `}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-left truncate flex-1">
                            {preset.label}
                          </h3>
                          <div className="flex gap-1 flex-shrink-0">
                            {preset.config.hasMetalImplant && (
                              <span className="text-xs">⚡</span>
                            )}
                            {preset.isCustom && (
                              <span className="text-xs">✏️</span>
                            )}
                          </div>
                        </div>
                        <p className={`text-xs text-left line-clamp-1 ${
                          tempSelectedId === preset.id 
                            ? 'text-primary-foreground/80' 
                            : 'text-muted-foreground'
                        }`}>
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleApplyPreset}>
                  Aplicar cenário
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
                  {(tissueConfig.skinThickness * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[tissueConfig.skinThickness * 100]}
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
                  {(tissueConfig.fatThickness * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[tissueConfig.fatThickness * 100]}
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
                  {(tissueConfig.muscleThickness * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[tissueConfig.muscleThickness * 100]}
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
                  {(tissueConfig.boneDepth * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[tissueConfig.boneDepth * 100]}
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
                  checked={tissueConfig.hasMetalImplant}
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
              {tissueConfig.hasMetalImplant && (
                <div className="space-y-6 pl-4 border-l-2 border-amber-500/30">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-sm">Profundidade do Implante</Label>
                      <span className="text-sm text-muted-foreground">
                        {((tissueConfig.metalImplantDepth || 0.5) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[(tissueConfig.metalImplantDepth || 0.5) * 100]}
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
                        {((tissueConfig.metalImplantSpan || 0.6) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[(tissueConfig.metalImplantSpan || 0.6) * 100]}
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

            {/* Editor de Inclusões */}
            <div className="pt-6 border-t">
              <TensInclusionsEditor
                inclusions={tissueConfig.inclusions || []}
                onChange={(inclusions) => updateCustomConfig({ inclusions })}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
