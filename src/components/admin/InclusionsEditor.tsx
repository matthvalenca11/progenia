import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { 
  UltrasoundInclusionConfig, 
  UltrasoundInclusionType, 
  UltrasoundInclusionShape,
  getAllAcousticMedia, 
  getAcousticMedium 
} from "@/types/acousticMedia";

interface InclusionsEditorProps {
  inclusions: UltrasoundInclusionConfig[];
  onChange: (inclusions: UltrasoundInclusionConfig[]) => void;
}

export function InclusionsEditor({ inclusions, onChange }: InclusionsEditorProps) {
  const allMedia = getAllAcousticMedia();

  const inclusionTypes: { value: UltrasoundInclusionType; label: string }[] = [
    { value: "cyst", label: "Cisto" },
    { value: "solid_mass", label: "Massa sólida" },
    { value: "vessel", label: "Vaso sanguíneo" },
    { value: "bone_surface", label: "Superfície óssea" },
    { value: "calcification", label: "Calcificação" },
    { value: "heterogeneous_lesion", label: "Lesão heterogênea" },
  ];

  const shapes: { value: UltrasoundInclusionShape; label: string }[] = [
    { value: "circle", label: "Círculo" },
    { value: "ellipse", label: "Elipse" },
    { value: "rectangle", label: "Retângulo" },
  ];

  const handleAddInclusion = () => {
    const newInclusion: UltrasoundInclusionConfig = {
      id: `incl-${Date.now()}`,
      type: "cyst",
      label: "Nova inclusão",
      shape: "circle",
      centerDepthCm: 2.0,
      centerLateralPos: 0,
      sizeCm: { width: 0.5, height: 0.5 },
      mediumInsideId: "cyst_fluid",
      hasStrongShadow: true,
      posteriorEnhancement: true,
      borderEchogenicity: "soft", // Padrão: difusa (mal definida)
    };
    onChange([...inclusions, newInclusion]);
  };

  const handleRemoveInclusion = (index: number) => {
    const newInclusions = inclusions.filter((_, i) => i !== index);
    onChange(newInclusions);
  };

  const handleUpdateInclusion = (index: number, updates: Partial<UltrasoundInclusionConfig>) => {
    const newInclusions = [...inclusions];
    newInclusions[index] = { ...newInclusions[index], ...updates };
    onChange(newInclusions);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inclusões</CardTitle>
        <CardDescription>
          Adicione estruturas localizadas (cistos, vasos, ossos, lesões)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inclusions list */}
        <div className="space-y-4">
          {inclusions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma inclusão definida. Clique em "Adicionar inclusão" para começar.
            </p>
          ) : (
            inclusions.map((inclusion, index) => {
              const medium = getAcousticMedium(inclusion.mediumInsideId);
              return (
                <Card key={inclusion.id} className="border-2">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-sm font-medium">Inclusão {index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInclusion(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Rótulo</Label>
                        <Input
                          value={inclusion.label}
                          onChange={(e) => handleUpdateInclusion(index, { label: e.target.value })}
                          placeholder="ex: Cisto subcutâneo"
                        />
                      </div>

                      <div>
                        <Label>Tipo</Label>
                        <Select
                          value={inclusion.type}
                          onValueChange={(value) => handleUpdateInclusion(index, { type: value as UltrasoundInclusionType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {inclusionTypes.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Forma</Label>
                        <Select
                          value={inclusion.shape}
                          onValueChange={(value) => handleUpdateInclusion(index, { shape: value as UltrasoundInclusionShape })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {shapes.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Meio interno</Label>
                        <Select
                          value={inclusion.mediumInsideId}
                          onValueChange={(value) => handleUpdateInclusion(index, { mediumInsideId: value as any })}
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
                      <Label>Profundidade: {inclusion.centerDepthCm.toFixed(1)} cm</Label>
                      <Slider
                        value={[inclusion.centerDepthCm]}
                        onValueChange={([value]) => handleUpdateInclusion(index, { centerDepthCm: value })}
                        min={0.5}
                        max={8.0}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Posição lateral: {inclusion.centerLateralPos.toFixed(2)}</Label>
                      <Slider
                        value={[inclusion.centerLateralPos]}
                        onValueChange={([value]) => handleUpdateInclusion(index, { centerLateralPos: value })}
                        min={-1.0}
                        max={1.0}
                        step={0.05}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">-1 = esquerda, 0 = centro, +1 = direita</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Largura: {inclusion.sizeCm.width.toFixed(1)} cm</Label>
                        <Slider
                          value={[inclusion.sizeCm.width]}
                          onValueChange={([value]) => 
                            handleUpdateInclusion(index, { 
                              sizeCm: { ...inclusion.sizeCm, width: value } 
                            })
                          }
                          min={0.1}
                          max={3.0}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label>Altura: {inclusion.sizeCm.height.toFixed(1)} cm</Label>
                        <Slider
                          value={[inclusion.sizeCm.height]}
                          onValueChange={([value]) => 
                            handleUpdateInclusion(index, { 
                              sizeCm: { ...inclusion.sizeCm, height: value } 
                            })
                          }
                          min={0.1}
                          max={3.0}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                    </div>

                    {/* Rendering flags */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Produz sombra acústica intensa</Label>
                        <Switch
                          checked={inclusion.hasStrongShadow || false}
                          onCheckedChange={(checked) => 
                            handleUpdateInclusion(index, { hasStrongShadow: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Gera reforço posterior</Label>
                        <Switch
                          checked={inclusion.posteriorEnhancement || false}
                          onCheckedChange={(checked) => 
                            handleUpdateInclusion(index, { posteriorEnhancement: checked })
                          }
                        />
                      </div>

                      <div>
                        <Label>Borda</Label>
                        <Select
                          value={inclusion.borderEchogenicity || "soft"}
                          onValueChange={(value: "sharp" | "soft") => 
                            handleUpdateInclusion(index, { borderEchogenicity: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Bem definida (nítida)</SelectItem>
                            <SelectItem value="soft">Mal definida (difusa)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Medium properties display */}
                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-2 rounded">
                      <div className="font-medium mb-1">Propriedades do meio interno:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <span>Impedância: {medium.acousticImpedance_MRayl} MRayl</span>
                        <span>Ecogenicidade: {medium.baseEchogenicity}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Button onClick={handleAddInclusion} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar inclusão
        </Button>

        {/* Mini 2D schematic preview */}
        {inclusions.length > 0 && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="mb-2 block">Visualização esquemática 2D</Label>
            <div className="relative w-full h-64 bg-gray-900 rounded overflow-hidden">
              {/* Depth scale */}
              <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-gray-400 py-2">
                {[0, 2, 4, 6, 8].map(depth => (
                  <span key={depth}>{depth}cm</span>
                ))}
              </div>
              
              {/* Inclusions */}
              <div className="absolute left-8 right-0 top-0 bottom-0">
                {inclusions.map((inclusion) => {
                  const top = (inclusion.centerDepthCm / 8) * 100;
                  const left = ((inclusion.centerLateralPos + 1) / 2) * 100;
                  const width = (inclusion.sizeCm.width / 3) * 100;
                  const height = (inclusion.sizeCm.height / 8) * 100;
                  
                  const shapeClass = inclusion.shape === "circle" ? "rounded-full" : 
                                   inclusion.shape === "ellipse" ? "rounded-full" : 
                                   "rounded";
                  
                  const colorClass = inclusion.type === "cyst" ? "bg-blue-400/60" :
                                   inclusion.type === "vessel" ? "bg-red-400/60" :
                                   inclusion.type === "bone_surface" ? "bg-gray-200/80" :
                                   "bg-yellow-400/60";
                  
                  return (
                    <div
                      key={inclusion.id}
                      className={`absolute ${shapeClass} ${colorClass} border border-white/40`}
                      style={{
                        top: `${top}%`,
                        left: `${left}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      title={inclusion.label}
                    />
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Representação aproximada das posições e tamanhos das inclusões
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
