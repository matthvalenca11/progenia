import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { virtualLabService, VirtualLab, VirtualLabType } from "@/services/virtualLabService";
import { UltrasoundLabBuilder } from "@/components/admin/ultrasound/UltrasoundLabBuilder";
import { TensLabConfigEditor } from "@/components/admin/TensLabConfigEditor";
import { defaultTensLabConfig } from "@/types/tensLabConfig";
import TensLabPage from "@/pages/TensLabPage";

export default function VirtualLabEditorUnified() {
  const navigate = useNavigate();
  const { labId } = useParams();
  const isEdit = !!labId;

  const [loading, setLoading] = useState(false);
  const [lab, setLab] = useState<Partial<VirtualLab>>({
    name: "",
    slug: "",
    title: "",
    description: "",
    lab_type: "ultrasound",
    config_data: {},
    is_published: false,
  });

  useEffect(() => {
    if (isEdit && labId) {
      loadLab();
    }
  }, [labId, isEdit]);

  const loadLab = async () => {
    try {
      setLoading(true);
      const data = await virtualLabService.getById(labId!);
      if (data) {
        setLab(data);
      }
    } catch (error: any) {
      console.error("Error loading lab:", error);
      toast.error("Erro ao carregar laboratório", { description: error.message });
      navigate("/admin/labs");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!lab.name?.trim()) {
      toast.error("Validação", { description: "O nome do laboratório é obrigatório" });
      return;
    }

    if (!lab.lab_type) {
      toast.error("Validação", { description: "O tipo de laboratório é obrigatório" });
      return;
    }

    try {
      setLoading(true);
      
      // Generate slug if empty
      const slug = lab.slug || virtualLabService.generateSlug(lab.name);
      const title = lab.title || lab.name;
      
      const labData = {
        ...lab,
        slug,
        title,
      } as VirtualLab;
      
      if (isEdit && labId) {
        await virtualLabService.update(labId, labData);
        toast.success("Sucesso!", { description: "Laboratório atualizado com sucesso" });
      } else {
        await virtualLabService.create(labData);
        toast.success("Sucesso!", { description: "Laboratório criado com sucesso" });
      }
      navigate("/admin/labs");
    } catch (error: any) {
      console.error("Error saving lab:", error);
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLabTypeChange = (newType: VirtualLabType) => {
    const updates: Partial<VirtualLab> = {
      lab_type: newType,
    };

    // Initialize config based on type
    if (newType === "tens") {
      updates.config_data = defaultTensLabConfig;
    } else if (newType === "ultrasound") {
      updates.config_data = {}; // Will be handled by UltrasoundLabBuilder
    }

    setLab({ ...lab, ...updates });
  };

  if (loading && isEdit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando laboratório...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin/labs")} disabled={loading}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {isEdit ? "Editar Laboratório Virtual" : "Novo Laboratório Virtual"}
              </h1>
              <p className="text-muted-foreground">
                Configure um laboratório virtual reutilizável
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Laboratório
              </>
            )}
          </Button>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Dados gerais do laboratório</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Laboratório *</Label>
                <Input
                  id="name"
                  value={lab.name}
                  onChange={(e) => setLab({ ...lab, name: e.target.value })}
                  placeholder="Ex: Simulador de TENS Interativo"
                />
              </div>

              <div>
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={lab.slug}
                  onChange={(e) => setLab({ ...lab, slug: e.target.value })}
                  placeholder="Ex: tens-interativo"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Será gerado automaticamente se deixar vazio
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={lab.description}
                onChange={(e) => setLab({ ...lab, description: e.target.value })}
                placeholder="Descrição breve do laboratório"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="labType">Tipo de Laboratório *</Label>
              <Select
                value={lab.lab_type}
                onValueChange={handleLabTypeChange}
                disabled={isEdit} // Não permitir mudar tipo ao editar
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultrasound">Ultrassom</SelectItem>
                  <SelectItem value="tens">TENS (Estimulação Elétrica Transcutânea)</SelectItem>
                  <SelectItem value="electrotherapy">Eletroterapia (Outros)</SelectItem>
                  <SelectItem value="thermal">Terapias Térmicas</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
              {isEdit && (
                <p className="text-xs text-muted-foreground mt-1">
                  O tipo não pode ser alterado após criar o laboratório
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Type-Specific Configuration */}
        {lab.lab_type === "ultrasound" && <UltrasoundLabBuilder />}
        
        {lab.lab_type === "tens" && lab.config_data && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,900px] gap-6">
            <div className="space-y-6">
              <TensLabConfigEditor
                config={lab.config_data}
                onChange={(config) => setLab({ ...lab, config_data: config })}
              />
            </div>
            
            {/* Preview do TENS */}
            <div className="xl:sticky xl:top-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preview do Simulador</CardTitle>
                  <CardDescription>
                    Visualize como o laboratório aparecerá para os alunos
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div 
                    className="w-full overflow-auto bg-gradient-to-br from-background via-background to-primary/5"
                    style={{
                      maxHeight: 'calc(100vh - 200px)',
                    }}
                  >
                    <div 
                      className="origin-top-left"
                      style={{
                        transform: 'scale(0.75)',
                        transformOrigin: 'top left',
                        width: '133.33%', // 100% / 0.75 to compensate for scale
                      }}
                    >
                      <TensLabPage config={lab.config_data} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!["ultrasound", "tens"].includes(lab.lab_type || "") && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Configuração para este tipo de laboratório ainda não está disponível.
                <br />
                Crie o laboratório e configure manualmente os dados no backend.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
