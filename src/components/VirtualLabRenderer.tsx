import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { MRIViewer } from "@/components/labs/MRIViewer";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";
import { EletroterapiaLab } from "@/components/labs/EletroterapiaLab";
import { ThermalLab } from "@/components/labs/ThermalLab";
import { ElectrotherapyDoseLab } from "@/components/labs/ElectrotherapyDoseLab";
import { TherapeuticUltrasoundLab } from "@/components/labs/TherapeuticUltrasoundLab";
import { LabWrapper } from "@/components/labs/LabWrapper";
import TensLabPage from "@/pages/TensLabPage";
import UltrasoundTherapyLabPage from "@/pages/UltrasoundTherapyLabPage";
import MRILabPage from "@/pages/MRILabPage";
import PhotobioLabPage from "@/pages/PhotobioLabPage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Beaker, ExternalLink, Loader2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface VirtualLabRendererProps {
  labId: string;
  className?: string;
}

function MobileLabFullscreen({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-background safe-area-bottom"
      style={{ height: "100dvh" }}
    >
      <div
        className="absolute right-2 z-[210]"
        style={{ top: "calc(var(--sat, env(safe-area-inset-top, 0px)) + 0.5rem)" }}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 bg-background/95 px-2 text-xs shadow-sm backdrop-blur"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
          Fechar
        </Button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  );
}

export function VirtualLabRenderer({ labId, className }: VirtualLabRendererProps) {
  const isMobile = useIsMobile();
  const [lab, setLab] = useState<VirtualLab | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const loadLab = async () => {
      if (!labId) {
        setError("ID do laboratório não fornecido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const labData = await virtualLabService.getById(labId);
        setLab(labData);
        setError(null);
      } catch (err: any) {
        console.error("Erro ao carregar lab virtual:", err);
        setError(err.message || "Erro ao carregar laboratório virtual");
      } finally {
        setLoading(false);
      }
    };

    loadLab();
  }, [labId]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mb-4 h-12 w-12 animate-spin" />
            <p>Carregando laboratório virtual...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !lab) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Beaker className="mb-4 h-12 w-12 opacity-50" />
            <p>{error || "Laboratório virtual não encontrado"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderLab = (embedded: boolean, previewMode = true) => {
    const config = lab.config_data || {};
    const labType = lab.lab_type as string;
    const labName = lab.title || lab.name;

    switch (labType) {
      case "ultrassom_simulador":
      case "ultrasound":
        return <UltrasoundUnifiedLab config={config} />;

      case "ultrassom_terapeutico":
      case "ultrasound_therapy":
        return (
          <UltrasoundTherapyLabPage
            config={config}
            previewMode={previewMode}
            embedded={embedded}
            labName={labName}
          />
        );

      case "tens":
        return <TensLabPage config={config} previewMode={previewMode} />;

      case "mri_viewer":
      case "mri":
        return <MRILabPage config={config} previewMode={previewMode} />;

      case "photobiomodulation":
      case "fbm":
        return <PhotobioLabPage config={config} previewMode={previewMode} />;

      case "eletroterapia_sim":
      case "electrotherapy":
        return <EletroterapiaLab config={config} />;

      case "eletroterapia_dose":
        return <ElectrotherapyDoseLab />;

      case "termico_sim":
      case "thermal":
        return <ThermalLab config={config} />;

      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Beaker className="mb-4 h-12 w-12 opacity-50" />
            <p>Tipo de laboratório não suportado: {labType}</p>
          </div>
        );
    }
  };

  const videoUrl = (lab.config_data as { videoUrl?: string })?.videoUrl;

  const fullscreenLab = (
    <LabWrapper videoUrl={videoUrl} title={lab.title} immersive showDisclaimer={false}>
      {renderLab(false, false)}
    </LabWrapper>
  );

  if (isMobile) {
    return (
      <>
        <div className={cn("w-full min-w-0 max-w-full", className)}>
          <div className="mb-2 flex justify-end px-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setFullscreen(true)}
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Tela cheia
            </Button>
          </div>
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/60">
            <LabWrapper videoUrl={videoUrl} title={lab.title} immersive showDisclaimer={false}>
              {renderLab(true)}
            </LabWrapper>
          </div>
        </div>

        {fullscreen && (
          <MobileLabFullscreen onClose={() => setFullscreen(false)}>{fullscreenLab}</MobileLabFullscreen>
        )}
      </>
    );
  }

  return (
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Beaker className="h-5 w-5 shrink-0" />
          <h3 className="font-semibold text-lg">{lab.title}</h3>
        </div>
        {lab.description && (
          <p className="text-sm text-muted-foreground">{lab.description}</p>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <LabWrapper videoUrl={videoUrl} title={lab.title}>
          {renderLab(false)}
        </LabWrapper>
      </div>
    </div>
  );
}
