import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { virtualLabService } from "@/services/virtualLabService";
import { toast } from "sonner";
import { UltrasoundLabBuilder } from "@/components/admin/ultrasound/UltrasoundLabBuilder";

export default function VirtualLabEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const {
    labName,
    labDescription,
    presetId,
    layers,
    inclusions,
    transducerType,
    frequency,
    depth,
    focus,
    gain,
    dynamicRange,
    mode,
    simulationFeatures,
    complexityLevel,
    studentControls,
    setLabId,
    loadConfig,
    resetToDefaults,
    validate,
  } = useUltrasoundLabStore();

  // Load lab data if editing
  useEffect(() => {
    const loadLab = async () => {
      if (!id) {
        resetToDefaults();
        return;
      }

      try {
        const lab = await virtualLabService.getById(id);
        if (!lab) {
          toast.error("Laboratório não encontrado");
          navigate("/admin/labs");
          return;
        }

        // Load configuration into store
        const config = lab.config_data as any;
        setLabId(lab.id || null);
        loadConfig({
          labName: lab.name,
          labDescription: lab.description || "",
          presetId: config.presetId || "muscle_generic",
          layers: config.layers || [],
          inclusions: config.inclusions || [],
          transducerType: config.transducerType || "linear",
          frequency: config.frequency || 10,
          depth: config.depth || 5,
          focus: config.focus || 2.5,
          gain: config.gain || 50,
          dynamicRange: config.dynamicRange || 60,
          mode: config.mode || "b-mode",
          simulationFeatures: config.simulationFeatures || {},
          complexityLevel: config.complexityLevel || "intermediario",
          studentControls: config.studentControls || {},
        });

        toast.success("Laboratório carregado");
      } catch (error: any) {
        console.error("Erro ao carregar laboratório:", error);
        toast.error("Erro ao carregar laboratório", { description: error.message });
        navigate("/admin/labs");
      }
    };

    loadLab();
  }, [id]);

  const handleSave = async () => {
    // Validate configuration
    const validation = validate();
    if (!validation.valid) {
      toast.error("Configuração inválida", {
        description: validation.errors.join(", "),
      });
      return;
    }

    try {
      const labData = {
        name: labName,
        title: labName,
        description: labDescription,
        lab_type: "ultrasound" as const,
        config_data: {
          presetId,
          layers,
          inclusions,
          transducerType,
          frequency,
          depth,
          focus,
          gain,
          dynamicRange,
          mode,
          simulationFeatures,
          complexityLevel,
          studentControls,
        },
        is_published: false,
      };

      if (isEditing && id) {
        await virtualLabService.update(id, labData);
        toast.success("Laboratório atualizado com sucesso!");
      } else {
        const newLab = await virtualLabService.create(labData);
        toast.success("Laboratório criado com sucesso!");
        navigate(`/admin/labs/editar/${newLab.id}`, { replace: true });
      }
    } catch (error: any) {
      console.error("Erro ao salvar laboratório:", error);
      toast.error("Erro ao salvar laboratório", { description: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/labs")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {isEditing ? "Editar Laboratório Virtual" : "Criar Novo Laboratório Virtual"}
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure todos os aspectos da simulação de ultrassom
              </p>
            </div>
          </div>
          <Button onClick={handleSave} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? "Salvar Alterações" : "Criar Laboratório"}
          </Button>
        </div>

        {/* Builder */}
        <UltrasoundLabBuilder />
      </div>
    </div>
  );
}
