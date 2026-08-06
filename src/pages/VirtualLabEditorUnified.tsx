import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Waves, Activity, Thermometer, Magnet, Sun } from "lucide-react";
import { toast } from "sonner";
import { virtualLabService, VirtualLab, VirtualLabType } from "@/services/virtualLabService";
import { UltrasoundLabBuilder } from "@/components/admin/ultrasound/UltrasoundLabBuilder";
import { TensLabConfigEditor } from "@/components/admin/TensLabConfigEditor";
import { UltrasoundTherapyLabConfigEditor } from "@/components/admin/UltrasoundTherapyLabConfigEditor";
import { MRILabConfigEditor } from "@/components/admin/MRILabConfigEditor";
import { MRILabPreview } from "@/components/admin/MRILabPreview";
import { LabVideoUploader } from "@/components/admin/LabVideoUploader";
import { assertValidYouTubeUrl } from "@/lib/youtube";
import { defaultTensLabConfig } from "@/types/tensLabConfig";
import {
  defaultUltrasoundTherapyConfig,
  mergeUltrasoundTherapyConfig,
  type UltrasoundTherapyConfig,
} from "@/types/ultrasoundTherapyConfig";
import { defaultMRILabConfig } from "@/types/mriLabConfig";
import {
  defaultPhotobioLabConfig,
  mergePhotobioLabConfig,
  type PhotobioLabConfig,
} from "@/types/photobioLabConfig";
import { PhotobioLabConfigEditor } from "@/components/admin/PhotobioLabConfigEditor";
import TensLabPage from "@/pages/TensLabPage";
import MRILabPage from "@/pages/MRILabPage";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { useMRILabStore } from "@/stores/mriLabStore";
import { isNativeApp } from "@/lib/capacitor";
import { cn } from "@/lib/utils";
import {
  adminLabConfigColumnClass,
  adminLabEditorBodyClass,
  adminLabEditorDualPanelEditorClass,
  adminLabEditorDualShellClass,
  adminLabEditorGridClass,
  adminLabEditorPageClass,
  adminLabPreviewColumnClass,
} from "@/components/admin/adminLabEditorLayout";

export default function VirtualLabEditorUnified() {
  const navigate = useNavigate();
  const { labId } = useParams();
  const isEdit = !!labId;
  const mriStore = useMRILabStore();

  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [mriPreviewMode, setMriPreviewMode] = useState<"student" | "admin">("student");
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
    if (!isNativeApp || !lab.lab_type) return;
    const dualTypes: VirtualLabType[] = [
      "ultrasound",
      "tens",
      "ultrasound_therapy",
      "mri",
      "photobiomodulation",
    ];
    if (!dualTypes.includes(lab.lab_type as VirtualLabType)) return;

    document.documentElement.classList.add("admin-lab-editor-scroll-lock");
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.classList.remove("admin-lab-editor-scroll-lock");
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [lab.lab_type]);

  useEffect(() => {
    if (isEdit && labId) {
      loadLab();
    } else {
      // Reset ultrasound store for new lab
      ultrasoundStore.resetToDefaults();
      // Limpar volume MRI se houver (novo lab)
      mriStore.clearVolume();
    }
    
    // Cleanup: limpar volume quando componente desmonta ou navega sem salvar
    return () => {
      // Só limpar se não salvou (não há labId salvo)
      if (!isEdit || !labId) {
        mriStore.clearVolume();
      }
    };
  }, [labId, isEdit]);

  const loadLab = async () => {
    try {
      setLoading(true);
      const data = await virtualLabService.getById(labId!);
      if (data) {
        const mergedData =
          data.lab_type === "photobiomodulation"
            ? { ...data, config_data: mergePhotobioLabConfig(data.config_data as Partial<PhotobioLabConfig>) }
            : data;
        setLab(mergedData);
        
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

      const userProvidedSlug = !!lab.slug?.trim();
      const baseSlug = userProvidedSlug ? lab.slug.trim() : virtualLabService.generateSlug(labName);

      // If slug was auto-generated, we can auto-fix collisions by appending -2, -3, ...
      // If user typed the slug, we should ask them to choose another one.
      const uniqueSlug = await virtualLabService.ensureUniqueSlug(baseSlug, isEdit ? labId : undefined);
      if (userProvidedSlug && uniqueSlug !== baseSlug) {
        toast.error("Erro ao salvar", { description: "Este slug já existe. Escolha outro para continuar." });
        return;
      }

      if (!userProvidedSlug && uniqueSlug !== baseSlug) {
        setLab((prev) => ({ ...prev, slug: uniqueSlug }));
        toast.info("Slug ajustado automaticamente", { description: `Novo slug: ${uniqueSlug}` });
      }

      const slug = uniqueSlug;
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
      if (videoUrl?.trim()) {
        assertValidYouTubeUrl(videoUrl.trim(), "vídeo de apoio do laboratório");
        configData = { ...configData, videoUrl: videoUrl.trim() };
      }

      // Silent migration (Photobiomodulation): merge with full schema, strip legacy keys
      if (lab.lab_type === "photobiomodulation") {
        const merged = mergePhotobioLabConfig(configData as Partial<PhotobioLabConfig>);
        const {
          visibleControls: _legacyVisibleControls,
          controlDisplayMode: _legacyControlDisplayMode,
          initialPreset: _legacyInitialPreset,
          ...rest
        } = (configData || {}) as Record<string, unknown>;
        void _legacyVisibleControls;
        void _legacyControlDisplayMode;
        void _legacyInitialPreset;
        configData = { ...rest, ...merged };
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
      
      // Limpar volume após salvar (dados já estão no config_data)
      if (lab.lab_type === "mri") {
        mriStore.clearVolume();
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
    } else if (newType === "ultrasound_therapy") {
      updates.config_data = defaultUltrasoundTherapyConfig;
    } else if (newType === "mri") {
      // Deep clone to avoid reference issues
      updates.config_data = JSON.parse(JSON.stringify(defaultMRILabConfig));
    } else if (newType === "photobiomodulation") {
      updates.config_data = structuredClone(defaultPhotobioLabConfig);
    }

    setLab({ ...lab, ...updates });
  };

  const dualPanelLabTypes: VirtualLabType[] = [
    "ultrasound",
    "tens",
    "ultrasound_therapy",
    "mri",
    "photobiomodulation",
  ];
  const usesDualPanelLayout =
    !!lab.lab_type && dualPanelLabTypes.includes(lab.lab_type as VirtualLabType);
  const nativeDualPanel = isNativeApp && usesDualPanelLayout;

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
    <div className={adminLabEditorPageClass}>
      <div className="container mx-auto min-w-0 shrink-0 py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <Button
              variant="ghost"
              className="shrink-0"
              onClick={() => {
                if (lab.lab_type === "mri") {
                  mriStore.clearVolume();
                }
                navigate("/admin/labs");
              }}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {isEdit ? "Editar Laboratório Virtual" : "Novo Laboratório Virtual"}
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Configure um laboratório virtual reutilizável
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} size="lg" className="w-full shrink-0 sm:w-auto">
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
      </div>

      <div className={adminLabEditorBodyClass}>
        <div
          className={cn(
            nativeDualPanel && adminLabEditorDualShellClass,
            !nativeDualPanel &&
              isNativeApp &&
              "container mx-auto min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-8 touch-pan-y admin-touch-scroll [-webkit-overflow-scrolling:touch]",
            !nativeDualPanel &&
              !isNativeApp &&
              "container mx-auto min-w-0 space-y-6 pb-8 md:pb-10",
          )}
        >

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
                  { value: "ultrasound", label: "Ultrassom", desc: "Simulador de imagem ultrassonográfica", icon: Waves },
                  { value: "tens", label: "TENS", desc: "Estimulação Elétrica Transcutânea", icon: Activity },
                  { value: "ultrasound_therapy", label: "Ultrassom Terapêutico", desc: "Simulador de ultrassom terapêutico com análise de penetração e aquecimento", icon: Thermometer },
                  { value: "mri", label: "Ressonância Magnética", desc: "Simulador de MRI com visualização de magnetização e fatias", icon: Magnet },
                  { value: "photobiomodulation", label: "Fotobiomodulação", desc: "Simulador de dose, penetração tecidual e zona Arndt-Schulz", icon: Sun },
                ].map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card 
                      key={type.value}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleLabTypeChange(type.value as VirtualLabType)}
                    >
                      <CardContent className="p-4 text-center">
                        <Icon className="h-8 w-8 mx-auto mb-2 text-primary/60" />
                        <h3 className="font-semibold">{type.label}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Type-Specific Configuration */}
        {lab.lab_type === "ultrasound" && (
          <div className={adminLabEditorDualPanelEditorClass}>
            <UltrasoundLabBuilder videoUrl={videoUrl} onVideoChange={setVideoUrl} />
          </div>
        )}

        {/* Basic Info for generic labs only (types without dedicated editors) */}
        {lab.lab_type &&
          !["ultrasound", "ultrasound_therapy", "tens", "mri", "photobiomodulation"].includes(
            lab.lab_type
          ) && (
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
          <div className={adminLabEditorDualPanelEditorClass}>
            <TensLabConfigEditor
              config={lab.config_data}
              onChange={(config) => setLab({ ...lab, config_data: config })}
              leadingContent={
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Informações Básicas</CardTitle>
                      <CardDescription>Defina o nome e descrição do laboratório</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="tens-name">Nome do Laboratório *</Label>
                        <Input
                          id="tens-name"
                          value={lab.name}
                          onChange={(e) => setLab({ ...lab, name: e.target.value })}
                          placeholder="Ex: TENS para Dor Lombar"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tens-description">Descrição</Label>
                        <Textarea
                          id="tens-description"
                          value={lab.description}
                          onChange={(e) => setLab({ ...lab, description: e.target.value })}
                          placeholder="Descreva os objetivos de aprendizado e o que os alunos poderão explorar neste laboratório..."
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <LabVideoUploader
                    videoUrl={videoUrl}
                    onVideoChange={setVideoUrl}
                    disabled={loading}
                  />
                </>
              }
            />
          </div>
        )}

        {/* Ultrasound Therapy Configuration */}
        {lab.lab_type === "ultrasound_therapy" && lab.config_data && (
          <div className={adminLabEditorDualPanelEditorClass}>
            <UltrasoundTherapyLabConfigEditor
              config={mergeUltrasoundTherapyConfig(lab.config_data as Partial<UltrasoundTherapyConfig>)}
              onChange={(config) => setLab({ ...lab, config_data: config })}
              leadingContent={
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
                            placeholder="Ex: Ultrassom de Ombro - Tendão Supraespinal"
                          />
                        </div>
                        <div>
                          <Label htmlFor="slug">Slug (URL) *</Label>
                          <Input
                            id="slug"
                            value={lab.slug}
                            onChange={(e) => setLab({ ...lab, slug: e.target.value })}
                            placeholder="Ex: ultrassom-terapeutico-ombro"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
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
                          placeholder="Descreva os objetivos de aprendizado e o que os alunos poderão explorar neste laboratório..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>Tipo de Laboratório</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm font-medium capitalize">Ultrassom Terapêutico</span>
                          {!isEdit && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => setLab({ ...lab, lab_type: undefined })}
                            >
                              (alterar)
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <LabVideoUploader
                    videoUrl={videoUrl}
                    onVideoChange={setVideoUrl}
                    disabled={loading}
                  />
                </>
              }
            />
          </div>
        )}

        {/* MRI Configuration with Live Preview */}
        {lab.lab_type === "mri" && (
          <div className={adminLabEditorDualPanelEditorClass}>
          <div className={adminLabEditorGridClass}>
            {/* Left: Configuration Editor */}
            <div className={adminLabConfigColumnClass}>
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
                        placeholder="Ex: Ressonância Magnética - Princípios Físicos"
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug">Slug (URL) *</Label>
                      <Input
                        id="slug"
                        value={lab.slug}
                        onChange={(e) => setLab({ ...lab, slug: e.target.value })}
                        placeholder="Ex: ressonancia-magnetica"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
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
                      placeholder="Descreva os objetivos de aprendizado e o que os alunos poderão explorar neste laboratório..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Tipo de Laboratório</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">Ressonância Magnética</span>
                      {!isEdit && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => setLab({ ...lab, lab_type: undefined })}
                        >
                          (alterar)
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <LabVideoUploader
                videoUrl={videoUrl}
                onVideoChange={setVideoUrl}
                disabled={loading}
              />

              {lab.config_data ? (
                <MRILabConfigEditor
                  config={lab.config_data}
                  onChange={(config) => setLab({ ...lab, config_data: config })}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Inicializando configuração...</p>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Right: Live Preview */}
            <div className={adminLabPreviewColumnClass}>
              <MRILabPreview
                embedded
                config={lab.config_data || defaultMRILabConfig}
                previewMode={mriPreviewMode}
                onPreviewModeChange={setMriPreviewMode}
                onConfigChange={(nextConfig) => setLab({ ...lab, config_data: nextConfig })}
              />
            </div>
          </div>
          </div>
        )}

        {lab.lab_type === "photobiomodulation" && (
          <div className={adminLabEditorDualPanelEditorClass}>
            <PhotobioLabConfigEditor
              config={mergePhotobioLabConfig(lab.config_data as Partial<PhotobioLabConfig>)}
              onChange={(config) => setLab({ ...lab, config_data: config })}
              leadingContent={
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Informações Básicas</CardTitle>
                      <CardDescription>Dados gerais do laboratório de fotobiomodulação</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Nome do Laboratório *</Label>
                          <Input
                            id="name"
                            value={lab.name}
                            onChange={(e) => setLab({ ...lab, name: e.target.value })}
                            placeholder="Ex: Fotobiomodulação - Janela Terapêutica"
                          />
                        </div>
                        <div>
                          <Label htmlFor="slug">Slug (URL) *</Label>
                          <Input
                            id="slug"
                            value={lab.slug}
                            onChange={(e) => setLab({ ...lab, slug: e.target.value })}
                            placeholder="Ex: fotobiomodulacao-v2"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
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
                          placeholder="Descreva os objetivos de aprendizado do laboratório FBM..."
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <LabVideoUploader
                    videoUrl={videoUrl}
                    onVideoChange={setVideoUrl}
                    disabled={loading}
                  />
                </>
              }
            />
          </div>
        )}

        {!["ultrasound", "tens", "ultrasound_therapy", "mri", "photobiomodulation"].includes(lab.lab_type || "") && (
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
    </div>
  );
}
