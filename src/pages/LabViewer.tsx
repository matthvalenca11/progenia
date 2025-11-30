import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";
import TensLabPage from "@/pages/TensLabPage";
import { toast } from "sonner";

export default function LabViewer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [lab, setLab] = useState<VirtualLab | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Render based on lab type
  if (lab.lab_type === "ultrasound") {
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
          <UltrasoundUnifiedLab config={lab.config_data as any} />
        </div>
      </div>
    );
  }

  if (lab.lab_type === "tens") {
    return <TensLabPage config={lab.config_data} />;
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
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Tipo de laboratório não suportado</h1>
          <p className="text-muted-foreground">
            Este tipo de laboratório ainda não está implementado.
          </p>
        </div>
      </div>
    </div>
  );
}
