import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Activity, Waves, Thermometer, ArrowRight, Loader2 } from "lucide-react";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { toast } from "sonner";

export default function VirtualLabsSection() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState<VirtualLab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLabs();
  }, []);

  const loadLabs = async () => {
    try {
      setLoading(true);
      const data = await virtualLabService.getPublishedLabs();
      setLabs(data);
    } catch (error: any) {
      console.error("Error loading labs:", error);
      toast.error("Erro ao carregar laboratórios");
    } finally {
      setLoading(false);
    }
  };

  const getLabIcon = (type: string) => {
    switch (type) {
      case "ultrasound":
        return <Waves className="h-24 w-24 text-primary/40 absolute" />;
      case "tens":
        return <Activity className="h-24 w-24 text-primary/40 absolute" />;
      case "ultrasound_therapy":
      case "ultrassom_terapeutico":
        return <Thermometer className="h-24 w-24 text-primary/40 absolute" />;
      default:
        return <FlaskConical className="h-24 w-24 text-primary/40 absolute" />;
    }
  };

  const getLabTypeLabel = (type: string) => {
    const labels = {
      ultrasound: "Ultrassom",
      tens: "Eletroterapia TENS",
      ultrasound_therapy: "Ultrassom Terapêutico",
      ultrassom_terapeutico: "Ultrassom Terapêutico",
      electrotherapy: "Eletroterapia",
      thermal: "Térmico",
      mri: "Ressonância Magnética",
      other: "Outro"
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold">Laboratórios Virtuais</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (labs.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-6">
        <FlaskConical className="h-6 w-6 text-primary" />
        <h2 className="text-3xl font-bold">Laboratórios Virtuais</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {labs.map((lab) => (
          <Card 
            key={lab.id}
            className="cursor-pointer hover:shadow-xl transition-all duration-300 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden group"
            onClick={() => navigate(`/labs/${lab.slug}`)}
          >
            <div className="flex flex-col md:flex-row">
              <div className="aspect-video md:w-64 bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                {getLabIcon(lab.lab_type)}
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              </div>
              <div className="p-6 flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full mb-3">
                  {lab.lab_type === "tens" ? (
                    <Activity className="h-4 w-4" />
                  ) : lab.lab_type === "ultrasound" ? (
                    <Waves className="h-4 w-4" />
                  ) : lab.lab_type === "ultrasound_therapy" || lab.lab_type === "ultrassom_terapeutico" ? (
                    <Thermometer className="h-4 w-4" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}
                  {getLabTypeLabel(lab.lab_type)}
                </div>
                <h3 className="font-bold text-2xl mb-2 group-hover:text-primary transition-colors">
                  {lab.title}
                </h3>
                <p className="text-muted-foreground mb-4 leading-relaxed line-clamp-3">
                  {lab.description}
                </p>
                <Button className="group-hover:shadow-lg transition-all">
                  Acessar Laboratório <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
