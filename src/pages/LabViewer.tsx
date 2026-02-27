import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";
import { LabWrapper } from "@/components/labs/LabWrapper";
import TensLabPage from "@/pages/TensLabPage";
import UltrasoundTherapyLabPage from "@/pages/UltrasoundTherapyLabPage";
import MRILabPage from "@/pages/MRILabPage";
import { toast } from "sonner";
import { labAnalyticsService } from "@/services/labAnalyticsService";

export default function LabViewer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [lab, setLab] = useState<VirtualLab | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const loadLab = async () => {
      if (!slug) {
        toast.error("Laboratório não encontrado");
        navigate("/dashboard");
        return;
      }

      try {
        setLoading(true);
        const data = await virtualLabService.getBySlug(slug);
        
        if (!data) {
          toast.error("Laboratório não encontrado");
          navigate("/dashboard");
          return;
        }

        if (!data.is_published) {
          toast.error("Este laboratório não está disponível");
          navigate("/dashboard");
          return;
        }

        setLab(data);
      } catch (error: any) {
        console.error("Error loading lab:", error);
        toast.error("Erro ao carregar laboratório", { description: error.message });
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadLab();
  }, [slug, navigate]);

  useEffect(() => {
    if (!lab?.id) return;

    const params = new URLSearchParams(location.search);
    const capsulaId = params.get("capsulaId");
    const sessionId = labAnalyticsService.createSessionId();
    sessionIdRef.current = sessionId;
    startedAtRef.current = Date.now();

    void labAnalyticsService.trackEvent({
      labId: lab.id,
      eventType: "open",
      sessionId,
      capsulaId,
      metadata: { slug: lab.slug, labType: lab.lab_type },
    });

    // Heartbeat de interação para refletir uso real no dashboard
    const heartbeat = window.setInterval(() => {
      if (!sessionIdRef.current || !lab.id) return;
      void labAnalyticsService.trackEvent({
        labId: lab.id,
        eventType: "interaction",
        sessionId: sessionIdRef.current,
        capsulaId,
        metadata: { heartbeat: true },
      });
    }, 30000);

    return () => {
      window.clearInterval(heartbeat);
      if (!sessionIdRef.current || !startedAtRef.current || !lab.id) return;

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      void labAnalyticsService.trackEvent({
        labId: lab.id,
        eventType: "close",
        sessionId: sessionIdRef.current,
        capsulaId,
        durationSeconds,
        metadata: { slug: lab.slug, labType: lab.lab_type },
      });
    };
  }, [lab?.id, lab?.lab_type, lab?.slug, location.search]);

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

  if (!lab) {
    return null;
  }

  // Extract video URL from config
  const videoUrl = (lab.config_data as any)?.videoUrl;

  // Debug log
  console.log('🔍 LabViewer: Renderizando lab', {
    id: lab.id,
    title: lab.title,
    name: lab.name,
    lab_type: lab.lab_type,
    lab_type_type: typeof lab.lab_type,
    lab_type_length: lab.lab_type?.length,
    lab_type_trimmed: lab.lab_type?.trim(),
    slug: lab.slug,
    hasConfig: !!lab.config_data,
    configKeys: lab.config_data ? Object.keys(lab.config_data).slice(0, 10) : [],
    isUltraSound: lab.lab_type === "ultrasound",
    isUltraSoundTherapy: lab.lab_type === "ultrasound_therapy",
    isUltraSomTerapeutico: lab.lab_type === "ultrassom_terapeutico",
  });

  // Render based on lab type - wrapped with LabWrapper for video + disclaimer
  const labType = String(lab.lab_type || '').trim();
  
  if (labType === "ultrasound") {
    console.log('✅ LabViewer: Renderizando UltrasoundUnifiedLab (DIAGNÓSTICO)');
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <LabWrapper videoUrl={videoUrl} title={lab.name}>
            <UltrasoundUnifiedLab config={lab.config_data as any} />
          </LabWrapper>
        </div>
      </div>
    );
  }

  if (labType === "tens") {
    return (
      <div className="min-h-screen bg-background">
        <LabWrapper videoUrl={videoUrl} title={lab.name}>
          <TensLabPage config={lab.config_data} />
        </LabWrapper>
      </div>
    );
  }

  if (labType === "ultrasound_therapy" || labType === "ultrassom_terapeutico") {
    console.log('✅ LabViewer: Renderizando UltrasoundTherapyLabPage (TERAPÊUTICO) para lab_type:', labType);
    console.log('📋 LabViewer: Config recebido:', {
      hasConfig: !!lab.config_data,
      configKeys: lab.config_data ? Object.keys(lab.config_data).slice(0, 15) : [],
      hasEra: !!(lab.config_data as any)?.era,
      hasGain: !!(lab.config_data as any)?.gain,
      hasDepth: !!(lab.config_data as any)?.depth,
    });
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <LabWrapper videoUrl={videoUrl} title={lab.title || lab.name}>
            <UltrasoundTherapyLabPage config={lab.config_data} />
          </LabWrapper>
        </div>
      </div>
    );
  }

  if (labType === "mri") {
    return (
      <div className="min-h-screen bg-background">
        <LabWrapper videoUrl={videoUrl} title={lab.title || lab.name}>
          <MRILabPage config={lab.config_data} />
        </LabWrapper>
      </div>
    );
  }

  // Fallback for unsupported lab types
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Dashboard
        </Button>
        <LabWrapper videoUrl={videoUrl} title={lab.name}>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Tipo de laboratório não suportado</h1>
            <p className="text-muted-foreground">
              Este tipo de laboratório ainda não está implementado.
            </p>
          </div>
        </LabWrapper>
      </div>
    </div>
  );
}
