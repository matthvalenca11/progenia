import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { virtualLabService } from "@/services/virtualLabService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UltrasoundLabBuilder } from "@/components/admin/ultrasound/UltrasoundLabBuilder";

export default function VirtualLabEditor() {
  const navigate = useNavigate();
  const { labId } = useParams();
  const isEditing = Boolean(labId);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const {
    labName,
    labDescription,
    presetId,
    layers,
    acousticLayers,
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
      if (!labId) {
        resetToDefaults();
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const lab = await virtualLabService.getById(labId);
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
          acousticLayers: config.acousticLayers || [],
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

        toast.success("Laboratório carregado com sucesso!");
      } catch (error: any) {
        console.error("Erro ao carregar laboratório:", error);
        toast.error("Erro ao carregar laboratório", { description: error.message });
        navigate("/admin/labs");
      } finally {
        setLoading(false);
      }
    };

    loadLab();
  }, [labId]);

  const handleSave = async () => {
    // Debug: Check current user and role
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Current user:", user?.id, user?.email);
    
    if (user) {
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      console.log("User roles:", roles, roleError);
    }
    
    // Validate configuration
    const validation = validate();
    if (!validation.valid) {
      toast.error("Configuração inválida", {
        description: validation.errors.join(", "),
      });
      return;
    }

    try {
      setSaving(true);
      const labData = {
        name: labName,
        slug: virtualLabService.generateSlug(labName),
        title: labName,
        description: labDescription,
        lab_type: "ultrasound" as const,
        config_data: {
          presetId,
          layers,
          acousticLayers,
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

      if (isEditing && labId) {
        await virtualLabService.update(labId, labData);
        toast.success("Laboratório atualizado com sucesso!");
        navigate("/admin/labs");
      } else {
        await virtualLabService.create(labData);
        toast.success("Laboratório criado com sucesso!");
        navigate("/admin/labs");
      }
    } catch (error: any) {
      console.error("Erro ao salvar laboratório:", error);
      toast.error("Erro ao salvar laboratório", { description: error.message });
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
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
          <Button onClick={handleSave} size="lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? "Salvar Alterações" : "Criar Laboratório"}
              </>
            )}
          </Button>
        </div>

        {/* Builder */}
        <UltrasoundLabBuilder />
      </div>
    </div>
  );
}
