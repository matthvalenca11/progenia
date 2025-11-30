import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, X } from "lucide-react";
import { tissueConfigService } from "@/services/tissueConfigService";
import { TissueConfig, TissueType } from "@/types/tissueConfig";
import { toast } from "sonner";
import { TensLateral3DView } from "@/components/labs/TensLateral3DView";

export const TissueConfigManager = () => {
  const [configs, setConfigs] = useState<TissueConfig[]>([]);
  const [editing, setEditing] = useState<TissueConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<TissueConfig>>({
    name: "",
    description: "",
    skinThickness: 0.15,
    fatThickness: 0.25,
    muscleThickness: 0.60,
    boneDepth: 0.85,
    hasMetalImplant: false,
    metalImplantDepth: 0.5,
    metalImplantSpan: 0.5,
    tissueType: "muscular",
    enableRiskSimulation: true,
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await tissueConfigService.getAll();
      setConfigs(data);
    } catch (error) {
      console.error("Error loading tissue configs:", error);
      toast.error("Erro ao carregar configurações de tecido");
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditing(null);
    setFormData({
      name: "",
      description: "",
      skinThickness: 0.15,
      fatThickness: 0.25,
      muscleThickness: 0.60,
      boneDepth: 0.85,
      hasMetalImplant: false,
      metalImplantDepth: 0.5,
      metalImplantSpan: 0.5,
      tissueType: "muscular",
      enableRiskSimulation: true,
    });
  };

  const handleEdit = (config: TissueConfig) => {
    setEditing(config);
    setIsCreating(false);
    setFormData(config);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditing(null);
    setFormData({
      name: "",
      description: "",
      skinThickness: 0.15,
      fatThickness: 0.25,
      muscleThickness: 0.60,
      boneDepth: 0.85,
      hasMetalImplant: false,
      tissueType: "muscular",
      enableRiskSimulation: true,
    });
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Nome é obrigatório");
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        await tissueConfigService.update(editing.id, formData);
        toast.success("Configuração atualizada com sucesso");
      } else {
        await tissueConfigService.create(formData as Omit<TissueConfig, "id" | "created_at" | "updated_at">);
        toast.success("Configuração criada com sucesso");
      }
      
      await loadConfigs();
      handleCancel();
    } catch (error) {
      console.error("Error saving tissue config:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta configuração?")) return;

    setLoading(true);
    try {
      await tissueConfigService.delete(id);
      toast.success("Configuração excluída com sucesso");
      await loadConfigs();
    } catch (error) {
      console.error("Error deleting tissue config:", error);
      toast.error("Erro ao excluir configuração");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Configurações Anatômicas TENS</h2>
          <p className="text-muted-foreground">Gerencie cenários anatômicos para simulação</p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating || editing !== null}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      {/* Form for Creating/Editing */}
      {(isCreating || editing) && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{editing ? "Editar" : "Nova"} Configuração Anatômica</CardTitle>
            <CardDescription>
              Configure as propriedades das camadas de tecido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Antebraço com implante"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do cenário anatômico"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Espessura da Pele: {(formData.skinThickness || 0).toFixed(2)}</Label>
                  <Slider
                    value={[formData.skinThickness || 0]}
                    onValueChange={(v) => setFormData({ ...formData, skinThickness: v[0] })}
                    min={0.05}
                    max={0.30}
                    step={0.01}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Espessura do Tecido Adiposo: {(formData.fatThickness || 0).toFixed(2)}</Label>
                  <Slider
                    value={[formData.fatThickness || 0]}
                    onValueChange={(v) => setFormData({ ...formData, fatThickness: v[0] })}
                    min={0.10}
                    max={0.70}
                    step={0.01}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Espessura Muscular: {(formData.muscleThickness || 0).toFixed(2)}</Label>
                  <Slider
                    value={[formData.muscleThickness || 0]}
                    onValueChange={(v) => setFormData({ ...formData, muscleThickness: v[0] })}
                    min={0.30}
                    max={0.90}
                    step={0.01}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Profundidade Óssea: {(formData.boneDepth || 0).toFixed(2)}</Label>
                  <Slider
                    value={[formData.boneDepth || 0]}
                    onValueChange={(v) => setFormData({ ...formData, boneDepth: v[0] })}
                    min={0.50}
                    max={1.00}
                    step={0.01}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Tipo de Tecido</Label>
                  <Select 
                    value={formData.tissueType || "muscular"} 
                    onValueChange={(value: TissueType) => setFormData({ ...formData, tissueType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soft">Mole</SelectItem>
                      <SelectItem value="muscular">Muscular</SelectItem>
                      <SelectItem value="mixed">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasMetalImplant"
                    checked={formData.hasMetalImplant || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasMetalImplant: checked })}
                  />
                  <Label htmlFor="hasMetalImplant">Possui Implante Metálico</Label>
                </div>

                {formData.hasMetalImplant && (
                  <>
                    <div>
                      <Label>Profundidade do Implante: {(formData.metalImplantDepth || 0).toFixed(2)}</Label>
                      <Slider
                        value={[formData.metalImplantDepth || 0.5]}
                        onValueChange={(v) => setFormData({ ...formData, metalImplantDepth: v[0] })}
                        min={0.20}
                        max={0.90}
                        step={0.01}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Extensão do Implante: {(formData.metalImplantSpan || 0).toFixed(2)}</Label>
                      <Slider
                        value={[formData.metalImplantSpan || 0.5]}
                        onValueChange={(v) => setFormData({ ...formData, metalImplantSpan: v[0] })}
                        min={0.20}
                        max={0.90}
                        step={0.01}
                        className="mt-2"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableRiskSimulation"
                    checked={formData.enableRiskSimulation || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableRiskSimulation: checked })}
                  />
                  <Label htmlFor="enableRiskSimulation">Habilitar Simulação de Riscos</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div>
                <Card className="bg-slate-950">
                  <CardHeader>
                    <CardTitle className="text-sm">Preview da Anatomia</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="scale-75 origin-top">
                      <TensLateral3DView
                        activationLevel={50}
                        comfortLevel={70}
                        frequency={80}
                        intensity={15}
                        pulseWidth={200}
                        mode="convencional"
                        tissueConfig={{
                          id: "preview",
                          name: formData.name || "Preview",
                          skinThickness: formData.skinThickness || 0.15,
                          fatThickness: formData.fatThickness || 0.25,
                          muscleThickness: formData.muscleThickness || 0.60,
                          boneDepth: formData.boneDepth || 0.85,
                          hasMetalImplant: formData.hasMetalImplant || false,
                          metalImplantDepth: formData.metalImplantDepth,
                          metalImplantSpan: formData.metalImplantSpan,
                          tissueType: formData.tissueType || "muscular",
                          enableRiskSimulation: formData.enableRiskSimulation || true,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List of Configs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((config) => (
          <Card key={config.id}>
            <CardHeader>
              <CardTitle className="text-lg">{config.name}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pele:</span>
                  <span>{config.skinThickness.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gordura:</span>
                  <span>{config.fatThickness.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Músculo:</span>
                  <span>{config.muscleThickness.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Osso:</span>
                  <span>{config.boneDepth.toFixed(2)}</span>
                </div>
                {config.hasMetalImplant && (
                  <div className="text-amber-400 text-xs font-medium pt-1">
                    ⚡ Com implante metálico
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEdit(config)}
                  disabled={loading || isCreating || editing !== null}
                  className="flex-1"
                >
                  Editar
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleDelete(config.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
