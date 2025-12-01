import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TissueInclusion, TissueInclusionType } from "@/types/tissueConfig";
import { Plus, Trash2, Layers } from "lucide-react";

interface TensInclusionsEditorProps {
  inclusions: TissueInclusion[];
  onChange: (inclusions: TissueInclusion[]) => void;
}

export function TensInclusionsEditor({ inclusions, onChange }: TensInclusionsEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addInclusion = () => {
    const newInclusion: TissueInclusion = {
      id: `inclusion-${Date.now()}`,
      type: "bone",
      depth: 0.5,
      span: 0.3,
      position: 0.5,
    };
    onChange([...inclusions, newInclusion]);
    setEditingId(newInclusion.id);
  };

  const removeInclusion = (id: string) => {
    onChange(inclusions.filter(i => i.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateInclusion = (id: string, updates: Partial<TissueInclusion>) => {
    onChange(
      inclusions.map(i => i.id === id ? { ...i, ...updates } : i)
    );
  };

  const getInclusionLabel = (inclusion: TissueInclusion) => {
    const typeLabel = inclusion.type === "bone" ? "Osso destacado" : "Implante metálico";
    const depthPercent = Math.round(inclusion.depth * 100);
    const posPercent = Math.round(inclusion.position * 100);
    return `${typeLabel} – ${depthPercent}% profundidade, posição ${posPercent}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Inclusões Anatômicas
        </CardTitle>
        <CardDescription>
          Adicione estruturas anatômicas específicas como focos ósseos ou implantes metálicos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de inclusões */}
        {inclusions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma inclusão adicionada</p>
            <p className="text-xs mt-1">Clique em "Adicionar inclusão" para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inclusions.map((inclusion) => (
              <div key={inclusion.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setEditingId(editingId === inclusion.id ? null : inclusion.id)}
                    className="flex-1 text-left text-sm font-medium hover:text-primary transition-colors"
                  >
                    {getInclusionLabel(inclusion)}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInclusion(inclusion.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Editor expandido */}
                {editingId === inclusion.id && (
                  <div className="space-y-4 pt-4 border-t">
                    {/* Tipo */}
                    <div className="space-y-2">
                      <Label>Tipo de Inclusão</Label>
                      <Select
                        value={inclusion.type}
                        onValueChange={(value) => updateInclusion(inclusion.id, { type: value as TissueInclusionType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bone">Osso destacado</SelectItem>
                          <SelectItem value="metal_implant">Implante metálico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Profundidade */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Profundidade</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(inclusion.depth * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[inclusion.depth * 100]}
                        onValueChange={(v) => updateInclusion(inclusion.id, { depth: v[0] / 100 })}
                        min={10}
                        max={90}
                        step={1}
                      />
                    </div>

                    {/* Extensão */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Extensão/Largura</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(inclusion.span * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[inclusion.span * 100]}
                        onValueChange={(v) => updateInclusion(inclusion.id, { span: v[0] / 100 })}
                        min={10}
                        max={80}
                        step={1}
                      />
                    </div>

                    {/* Posição */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Posição entre eletrodos</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(inclusion.position * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[inclusion.position * 100]}
                        onValueChange={(v) => updateInclusion(inclusion.id, { position: v[0] / 100 })}
                        min={0}
                        max={100}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>← Esquerda</span>
                        <span>Centro</span>
                        <span>Direita →</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botão adicionar */}
        <Button
          onClick={addInclusion}
          variant="outline"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar inclusão
        </Button>
      </CardContent>
    </Card>
  );
}
