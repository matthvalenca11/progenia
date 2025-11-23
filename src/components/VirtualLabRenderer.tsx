import { useEffect, useState } from "react";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { MRIViewer } from "@/components/labs/MRIViewer";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";
import { EletroterapiaLab } from "@/components/labs/EletroterapiaLab";
import { ThermalLab } from "@/components/labs/ThermalLab";
import { ElectrotherapyDoseLab } from "@/components/labs/ElectrotherapyDoseLab";
import { TherapeuticUltrasoundLab } from "@/components/labs/TherapeuticUltrasoundLab";
import { Card, CardContent } from "@/components/ui/card";
import { Beaker, Loader2 } from "lucide-react";

interface VirtualLabRendererProps {
  labId: string;
  className?: string;
}

export function VirtualLabRenderer({ labId, className }: VirtualLabRendererProps) {
  const [lab, setLab] = useState<VirtualLab | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-12 w-12 animate-spin mb-4" />
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
            <Beaker className="h-12 w-12 mb-4 opacity-50" />
            <p>{error || "Laboratório virtual não encontrado"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderLab = () => {
    const config = lab.config_data || {};
    const labType = lab.lab_type as string;

    switch (labType) {
      case "mri_viewer":
      case "mri":
        return <MRIViewer config={config} />;
      
      case "ultrassom_simulador":
      case "ultrasound":
        // Pass the complete configuration directly to UltrasoundUnifiedLab
        return <UltrasoundUnifiedLab config={config} />;
      
      case "eletroterapia_sim":
      case "electrotherapy":
        return <EletroterapiaLab config={config} />;
      
      case "eletroterapia_dose":
        return <ElectrotherapyDoseLab />;
      
      case "ultrassom_terapeutico":
        return <TherapeuticUltrasoundLab />;
      
      case "termico_sim":
      case "thermal":
        return <ThermalLab config={config} />;
      
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Beaker className="h-12 w-12 mb-4 opacity-50" />
            <p>Tipo de laboratório não suportado: {labType}</p>
          </div>
        );
    }
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Beaker className="h-5 w-5" />
          <h3 className="font-semibold text-lg">{lab.title}</h3>
        </div>
        {lab.description && (
          <p className="text-sm text-muted-foreground">{lab.description}</p>
        )}
      </div>
      {renderLab()}
    </div>
  );
}