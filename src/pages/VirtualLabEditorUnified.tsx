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
import { LabVideoUploader } from "@/components/admin/LabVideoUploader";
import { defaultTensLabConfig } from "@/types/tensLabConfig";
import TensLabPage from "@/pages/TensLabPage";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";

export default function VirtualLabEditorUnified() {
  const navigate = useNavigate();
  const { labId } = useParams();
  const isEdit = !!labId;

  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [lab, setLab] = useState<Partial<VirtualLab>>({
    name: "",
    slug: "",
    title: "",
    description: "",
    lab_type: undefined, // No default type - user must select
    config_data: {},
    is_published: false,
  });

  // Access Zustand store for ultrasound lab configuration
  const ultrasoundStore = useUltrasoundLabStore();

  useEffect(() => {
    if (isEdit && labId) {
      loadLab();
    } else {
      // Reset ultrasound store for new lab
      ultrasoundStore.resetToDefaults();
    }
  }, [labId, isEdit]);

  const loadLab = async () => {
    try {
      setLoading(true);
      const data = await virtualLabService.getById(labId!);
      if (data) {
        setLab(data);
        
        // Load video URL from config_data
        if (data.config_data?.videoUrl) {
          setVideoUrl(data.config_data.videoUrl);
        }
        
        // If ultrasound lab, load config into Zustand store
        if (data.lab_type === "ultrasound" && data.config_data) {
          ultrasoundStore.loadConfig({
            labId: data.id,
            labName: data.name,
            labDescription: data.description || '',
            ...data.config_data
          });
        }
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
    // For ultrasound labs, get name from Zustand store
    const labName = lab.lab_type === "ultrasound" ? ultrasoundStore.labName : lab.name;
    
    // Validation
    if (!labName?.trim()) {
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
      const slug = lab.slug || virtualLabService.generateSlug(labName);
      const title = lab.title || labName;
      
      // For ultrasound labs, get config from Zustand store
      let configData = lab.config_data || {};
      if (lab.lab_type === "ultrasound") {
        const storeState = ultrasoundStore;
        configData = {
          presetId: storeState.presetId,
          layers: storeState.layers,
          acousticLayers: storeState.acousticLayers,
          inclusions: storeState.inclusions,
          transducerType: storeState.transducerType,
          frequency: storeState.frequency,
          depth: storeState.depth,
          focus: storeState.focus,
          gain: storeState.gain,
          dynamicRange: storeState.dynamicRange,
          mode: storeState.mode,
          simulationFeatures: storeState.simulationFeatures,
          complexityLevel: storeState.complexityLevel,
          studentControls: storeState.studentControls,
        };
      }
      
      // Add video URL to config_data (applies to ALL lab types)
      if (videoUrl) {
        configData = { ...configData, videoUrl };
      }
      
      const labData = {
        ...lab,
        name: labName, // Use labName which comes from store for ultrasound
        slug,
        title,
        config_data: configData,
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

        {/* Step 1: Type Selection (only for new labs without type) */}
        {!lab.lab_type && !isEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Tipo de Laboratório</CardTitle>
              <CardDescription>Escolha qual tipo de simulador você deseja criar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { value: "ultrasound", label: "Ultrassom", desc: "Simulador de imagem ultrassonográfica" },
                  { value: "tens", label: "TENS", desc: "Estimulação Elétrica Transcutânea" },
                  { value: "electrotherapy", label: "Eletroterapia", desc: "Outros métodos de eletroterapia" },
                  { value: "thermal", label: "Terapias Térmicas", desc: "Simuladores de calor/frio" },
                  { value: "other", label: "Outro", desc: "Tipo personalizado" },
                ].map((type) => (
                  <Card 
                    key={type.value}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleLabTypeChange(type.value as VirtualLabType)}
                  >
                    <CardContent className="p-4 text-center">
                      <h3 className="font-semibold">{type.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Type-Specific Configuration */}
        {lab.lab_type === "ultrasound" && (
          <UltrasoundLabBuilder 
            videoUrl={videoUrl}
            onVideoChange={setVideoUrl}
          />
        )}

        {/* Basic Info for non-ultrasound labs */}
        {lab.lab_type && lab.lab_type !== "ultrasound" && (
          <>
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
                  <Label>Tipo de Laboratório</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium capitalize">{lab.lab_type}</span>
                    {!isEdit && (
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-xs p-0 h-auto"
                        onClick={() => setLab({ ...lab, lab_type: undefined })}
                      >
                        (alterar)
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Video Uploader for non-ultrasound */}
            <LabVideoUploader
              videoUrl={videoUrl}
              onVideoChange={setVideoUrl}
              disabled={loading}
            />
          </>
        )}

        {/* TENS Configuration */}
        {lab.lab_type === "tens" && lab.config_data && (
          <TensLabConfigEditor
            config={lab.config_data}
            onChange={(config) => setLab({ ...lab, config_data: config })}
          />
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
