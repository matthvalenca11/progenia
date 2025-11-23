import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { UltrasoundLayerConfig, getAllAcousticMedia, getAcousticMedium } from "@/types/acousticMedia";

interface AcousticLayersEditorProps {
  layers: UltrasoundLayerConfig[];
  onChange: (layers: UltrasoundLayerConfig[]) => void;
}

export function AcousticLayersEditor({ layers, onChange }: AcousticLayersEditorProps) {
  const allMedia = getAllAcousticMedia();

  const handleAddLayer = () => {
    const newLayer: UltrasoundLayerConfig = {
      id: `layer-${Date.now()}`,
      mediumId: "muscle",
      name: "Nova camada",
      thicknessCm: 1.0,
      noiseScale: 1.0,
      reflectivityBias: 0,
    };
    onChange([...layers, newLayer]);
  };

  const handleRemoveLayer = (index: number) => {
    const newLayers = layers.filter((_, i) => i !== index);
    onChange(newLayers);
  };

  const handleUpdateLayer = (index: number, updates: Partial<UltrasoundLayerConfig>) => {
    const newLayers = [...layers];
    newLayers[index] = { ...newLayers[index], ...updates };
    onChange(newLayers);
  };

  const getTotalDepth = () => {
    return layers.reduce((sum, layer) => sum + layer.thicknessCm, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meios & Camadas Acústicas</CardTitle>
        <CardDescription>
          Configure as camadas de tecido com propriedades acústicas específicas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Layers list */}
        <div className="space-y-4">
          {layers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma camada definida. Clique em "Adicionar camada" para começar.
            </p>
          ) : (
            layers.map((layer, index) => {
              const medium = getAcousticMedium(layer.mediumId);
              return (
                <Card key={layer.id} className="border-2">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Camada {index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLayer(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nome da camada</Label>
                        <Input
                          value={layer.name}
                          onChange={(e) => handleUpdateLayer(index, { name: e.target.value })}
                          placeholder="ex: Pele, Gordura"
                        />
                      </div>

                      <div>
                        <Label>Meio acústico</Label>
                        <Select
                          value={layer.mediumId}
                          onValueChange={(value) => handleUpdateLayer(index, { mediumId: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allMedia.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Espessura: {layer.thicknessCm.toFixed(1)} cm</Label>
                      <Slider
                        value={[layer.thicknessCm]}
                        onValueChange={([value]) => handleUpdateLayer(index, { thicknessCm: value })}
                        min={0.1}
                        max={5.0}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Escala de textura: {layer.noiseScale?.toFixed(1) || "1.0"}</Label>
                        <Slider
                          value={[layer.noiseScale || 1.0]}
                          onValueChange={([value]) => handleUpdateLayer(index, { noiseScale: value })}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label>Ajuste de refletividade: {layer.reflectivityBias?.toFixed(1) || "0.0"}</Label>
                        <Slider
                          value={[layer.reflectivityBias || 0]}
                          onValueChange={([value]) => handleUpdateLayer(index, { reflectivityBias: value })}
                          min={-1.0}
                          max={1.0}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                    </div>

                    {/* Medium properties display */}
                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-2 rounded">
                      <div className="grid grid-cols-2 gap-2">
                        <span>Impedância: {medium.acousticImpedance_MRayl} MRayl</span>
                        <span>Atenuação: {medium.attenuation_dB_per_cm_MHz} dB/cm/MHz</span>
                        <span>Velocidade: {medium.speedOfSound_m_per_s} m/s</span>
                        <span>Ecogenicidade: {medium.baseEchogenicity}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Button onClick={handleAddLayer} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar camada
        </Button>

      </CardContent>
    </Card>
  );
}
