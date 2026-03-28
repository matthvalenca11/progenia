import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";
import { LabWrapper } from "@/components/labs/LabWrapper";
import TensLabPage from "@/pages/TensLabPage";
import UltrasoundTherapyLabPage from "@/pages/UltrasoundTherapyLabPage";
import MRILabPage from "@/pages/MRILabPage";
import PhotobioLabPage from "@/pages/PhotobioLabPage";
import { toast } from "sonner";
import { labAnalyticsService } from "@/services/labAnalyticsService";
import { useAuth } from "@/hooks/useAuth";
import { LabDemoBoundary } from "@/contexts/LabDemoContext";
import { cn } from "@/lib/utils";

export type LabExperienceProps = {
  slug: string;
  variant?: "page" | "modal";
  onClose?: () => void;
  capsulaId?: string | null;
};

export function LabExperience({ slug, variant = "page", onClose, capsulaId = null }: LabExperienceProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [lab, setLab] = useState<VirtualLab | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const exit = () => {
    if (variant === "modal" && onCloseRef.current) {
      onCloseRef.current();
      return;
    }
    navigate(userRef.current ? "/dashboard" : "/");
  };

  useEffect(() => {
    const loadLab = async () => {
      if (!slug) {
        toast.error("Laboratório não encontrado");
        exit();
        return;
      }

      try {
        setLoading(true);
        const data = await virtualLabService.getBySlug(slug);

        if (!data) {
          toast.error("Laboratório não encontrado");
          exit();
          return;
        }

        if (!data.is_published) {
          toast.error("Este laboratório não está disponível");
          exit();
          return;
        }

        setLab(data);
      } catch (error: unknown) {
        console.error("Error loading lab:", error);
        const message = error instanceof Error ? error.message : String(error);
        toast.error("Erro ao carregar laboratório", { description: message });
        exit();
      } finally {
        setLoading(false);
      }
    };

    void loadLab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!lab?.id) return;

    const sessionId = labAnalyticsService.createSessionId();
    sessionIdRef.current = sessionId;
    startedAtRef.current = Date.now();

    void labAnalyticsService.trackEvent({
      labId: lab.id,
      eventType: "open",
      sessionId,
      capsulaId,
      metadata: { slug: lab.slug, labType: lab.lab_type, variant },
    });

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
        metadata: { slug: lab.slug, labType: lab.lab_type, variant },
      });
    };
  }, [lab?.id, lab?.lab_type, lab?.slug, capsulaId, variant]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 bg-background",
          variant === "page" ? "min-h-screen" : "min-h-[220px] py-12",
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando laboratório...</p>
      </div>
    );
  }

  if (!lab) {
    return null;
  }

  const videoUrl = (lab.config_data as { videoUrl?: string })?.videoUrl;
  const labType = String(lab.lab_type || "").trim();
  const demoAsGuest = !authLoading && !user;
  const backLabel =
    variant === "modal" ? "Fechar" : user ? "Voltar ao Dashboard" : "Voltar ao início";

  const core = (
    <LabWrapper videoUrl={videoUrl} title={lab.title || lab.name}>
      <LabDemoBoundary
        slug={lab.slug}
        enabled={demoAsGuest}
        onDismissSecondary={variant === "modal" ? () => onCloseRef.current?.() : undefined}
      >
        {renderLabContent(labType, lab)}
      </LabDemoBoundary>
    </LabWrapper>
  );

  if (variant === "modal") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-background">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-border pb-3 pr-1">
          <h2 className="truncate pr-2 text-left text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {lab.title || lab.name}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1 rounded-lg"
            onClick={() => exit()}
          >
            <X className="h-4 w-4" />
            {backLabel}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
          {core}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate(user ? "/dashboard" : "/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
        {core}
      </div>
    </div>
  );
}

function renderLabContent(labType: string, lab: VirtualLab): ReactNode {
  if (labType === "ultrasound") {
    return <UltrasoundUnifiedLab config={lab.config_data as Record<string, unknown>} />;
  }
  if (labType === "tens") {
    return <TensLabPage config={lab.config_data} />;
  }
  if (labType === "ultrasound_therapy" || labType === "ultrassom_terapeutico") {
    return <UltrasoundTherapyLabPage config={lab.config_data} />;
  }
  if (labType === "mri") {
    return <MRILabPage config={lab.config_data} />;
  }
  if (labType === "photobiomodulation" || labType === "fbm") {
    return <PhotobioLabPage config={lab.config_data as Record<string, unknown>} />;
  }
  return (
    <div className="py-12 text-center">
      <h1 className="mb-4 text-2xl font-bold">Tipo de laboratório não suportado</h1>
      <p className="text-muted-foreground">Este tipo de laboratório ainda não está implementado.</p>
    </div>
  );
}
