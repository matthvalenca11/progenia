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
    { value: "ellipse", label: "Elipse" },
    { value: "rectangle", label: "Retângulo" },
    { value: "capsule", label: "Cápsula (Vaso Longitudinal)" },
    { value: "vessel_ascending", label: "Vaso Ascendente ↗" },
    { value: "vessel_descending", label: "Vaso Descendente ↘" },
  ];

  const handleAddInclusion = () => {
    const newInclusion: UltrasoundInclusionConfig = {
      id: `incl-${Date.now()}`,
      type: "cyst",
      label: "Nova inclusão",
      shape: "ellipse",
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
                          max={8.0}
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

                    {/* Anatomical realism controls for capsule/vessel shapes */}
                    {(inclusion.shape === 'capsule' || inclusion.shape === 'vessel_ascending' || inclusion.shape === 'vessel_descending') && (
                      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                        <Label className="text-sm font-medium">Realismo Anatômico (Vasos)</Label>
                        
                        <div>
                          <Label className="text-xs">
                            Rotação: {(inclusion.rotationDegrees ?? (inclusion.shape === 'vessel_ascending' ? 12 : inclusion.shape === 'vessel_descending' ? -12 : 0)).toFixed(0)}°
                          </Label>
                          <Slider
                            value={[inclusion.rotationDegrees ?? (inclusion.shape === 'vessel_ascending' ? 12 : inclusion.shape === 'vessel_descending' ? -12 : 0)]}
                            onValueChange={([value]) => handleUpdateInclusion(index, { rotationDegrees: value })}
                            min={-30}
                            max={30}
                            step={1}
                            className="mt-1"
                          />
                          <p className="text-[10px] text-muted-foreground">Ângulo do vaso (negativo = desce, positivo = sobe)</p>
                        </div>

                        <div>
                          <Label className="text-xs">
                            Irregularidade da parede: {((inclusion.wallIrregularity ?? 0) * 100).toFixed(0)}%
                          </Label>
                          <Slider
                            value={[(inclusion.wallIrregularity ?? 0) * 100]}
                            onValueChange={([value]) => handleUpdateInclusion(index, { wallIrregularity: value / 100 })}
                            min={0}
                            max={10}
                            step={0.5}
                            className="mt-1"
                          />
                          <p className="text-[10px] text-muted-foreground">Variação natural da espessura da parede</p>
                        </div>

                        <div>
                          <Label className="text-xs">
                            Assimetria anterior/posterior: {((inclusion.wallAsymmetry ?? 0) * 100).toFixed(1)}%
                          </Label>
                          <Slider
                            value={[(inclusion.wallAsymmetry ?? 0) * 100]}
                            onValueChange={([value]) => handleUpdateInclusion(index, { wallAsymmetry: value / 100 })}
                            min={0}
                            max={5}
                            step={0.1}
                            className="mt-1"
                          />
                          <p className="text-[10px] text-muted-foreground">Parede posterior mais espessa que anterior</p>
                        </div>
                      </div>
                    )}

                    {/* Rendering flags */}
                    <div className="space-y-2">

                      <div className="flex items-center justify-between">
                        <Label>Gera reforço posterior</Label>
                        <Switch
                          checked={inclusion.posteriorEnhancement !== false}
                          onCheckedChange={(checked) => 
                            handleUpdateInclusion(index, { posteriorEnhancement: checked })
                          }
                        />
                      </div>

                      <div>
                        <Label>Borda</Label>
                        <Select
                          value={inclusion.borderEchogenicity ?? "soft"}
                          onValueChange={(value: "sharp" | "soft") => 
                            handleUpdateInclusion(index, { borderEchogenicity: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="soft">Mal definida (difusa)</SelectItem>
                            <SelectItem value="sharp">Bem definida (nítida)</SelectItem>
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
            <div className="relative w-full h-80 bg-slate-950 rounded overflow-hidden border border-border">
              {/* Depth scale */}
              <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-slate-400 py-4 bg-slate-900/50 border-r border-slate-700">
                {[0, 2, 4, 6, 8, 10].map(depth => (
                  <span key={depth} className="px-1 font-mono">{depth}cm</span>
                ))}
              </div>
              
              {/* Grid lines */}
              <div className="absolute left-12 right-0 top-0 bottom-0">
                {[0, 20, 40, 60, 80, 100].map(percent => (
                  <div
                    key={`h-${percent}`}
                    className="absolute left-0 right-0 border-t border-slate-800/50"
                    style={{ top: `${percent}%` }}
                  />
                ))}
                {[0, 25, 50, 75, 100].map(percent => (
                  <div
                    key={`v-${percent}`}
                    className="absolute top-0 bottom-0 border-l border-slate-800/50"
                    style={{ left: `${percent}%` }}
                  />
                ))}
              </div>
              
              {/* Transducer representation at top */}
              <div className="absolute left-12 right-0 top-0 h-2 bg-gradient-to-b from-blue-500/40 to-transparent" />
              
              {/* Inclusions */}
              <div className="absolute left-12 right-0 top-0 bottom-0">
                {inclusions.map((inclusion) => {
                  const top = (inclusion.centerDepthCm / 10) * 100;
                  const left = ((inclusion.centerLateralPos + 1) / 2) * 100;
                  const width = Math.max((inclusion.sizeCm.width / 4) * 100, 3);
                  const height = Math.max((inclusion.sizeCm.height / 10) * 100, 2);
                  
                  const shapeClass = inclusion.shape === "ellipse" ? "rounded-full" : 
                                   inclusion.shape === "rectangle" ? "rounded-sm" :
                                   "rounded-full"; // capsule and vessel shapes render as elongated ellipse
                  
                  // Calculate rotation for vessel shapes
                  let rotationDeg = inclusion.rotationDegrees ?? 0;
                  if (inclusion.shape === "vessel_ascending" && !inclusion.rotationDegrees) {
                    rotationDeg = 12;
                  } else if (inclusion.shape === "vessel_descending" && !inclusion.rotationDegrees) {
                    rotationDeg = -12;
                  }
                  
                  let colorClass = "";
                  let borderClass = "";
                  let labelColor = "";
                  
                  switch (inclusion.type) {
                    case "cyst":
                      colorClass = "bg-blue-500/70";
                      borderClass = "border-blue-300/60";
                      labelColor = "text-blue-200";
                      break;
                    case "vessel":
                      colorClass = "bg-red-500/70";
                      borderClass = "border-red-300/60";
                      labelColor = "text-red-200";
                      break;
                    case "bone_surface":
                      colorClass = "bg-gray-200/90";
                      borderClass = "border-gray-100";
                      labelColor = "text-gray-900";
                      break;
                    default:
                      colorClass = "bg-yellow-500/70";
                      borderClass = "border-yellow-300/60";
                      labelColor = "text-yellow-200";
                  }
                  
                  // Add shadow effect if configured
                  const shadowClass = inclusion.hasStrongShadow ? "shadow-lg shadow-black/50" : "";
                  
                  // Add enhancement glow if configured
                  const glowClass = inclusion.posteriorEnhancement ? "ring-2 ring-white/30" : "";
                  
                  return (
                    <div
                      key={inclusion.id}
                      className="absolute group"
                      style={{
                        top: `${top}%`,
                        left: `${left}%`,
                        transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
                      }}
                    >
                      <div
                        className={`${shapeClass} ${colorClass} ${shadowClass} ${glowClass} border-2 ${borderClass} transition-all hover:scale-110`}
                        style={{
                          width: `${width}px`,
                          height: `${height}px`,
                          minWidth: '12px',
                          minHeight: '12px',
                        }}
                      />
                      {/* Label on hover */}
                      <div className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-xs ${labelColor} bg-slate-900/90 px-2 py-1 rounded border border-slate-700 pointer-events-none z-10`}>
                        {inclusion.label}
                        <div className="text-[10px] text-slate-400">
                          {inclusion.centerDepthCm.toFixed(1)}cm × {inclusion.sizeCm.width.toFixed(1)}cm
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Representação esquemática das inclusões (passe o mouse para detalhes)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
