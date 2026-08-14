import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Activity, Waves, Target, Magnet, Sun, ArrowRight, Loader2, Layers } from "lucide-react";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { isNativeApp } from "@/lib/capacitor";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function VirtualLabsSection() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [labs, setLabs] = useState<VirtualLab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNativeApp) return;
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

  const arSliceModalities = isEnglish
    ? ["MRI", "CT", "PET", "PET/CT"]
    : ["RM", "TC", "PET", "PET/TC"];

  const arSliceCard = (
    <Card
      className="cursor-pointer hover:shadow-xl transition-all duration-300 border-cyan-500/30 bg-gradient-to-br from-card via-card to-cyan-500/5 overflow-hidden group"
      onClick={() => navigate("/labs/ar-slice")}
    >
      <div className="flex flex-col md:flex-row">
        <div
          className="aspect-video md:w-64 flex-shrink-0 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950"
          aria-hidden
        >
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.35),transparent_55%)]" />
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:18px_18px]" />
          {/* AR hoop + axial slice */}
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="relative h-[72%] w-[72%] max-h-32 max-w-32 rounded-full border-2 border-cyan-400/70 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
              <div
                className="absolute inset-[10%] rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 opacity-90"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 38% 42%, rgba(255,255,255,0.55), transparent 42%), radial-gradient(circle at 62% 58%, rgba(15,23,42,0.35), transparent 48%)",
                }}
              />
              <div className="absolute inset-[10%] rounded-full border border-white/20" />
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            {arSliceModalities.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="p-6 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-medium rounded-full mb-3">
            <Layers className="h-4 w-4" />
            {isEnglish ? "Medical imaging · AR" : "Imagem médica · RA"}
          </div>
          <h3 className="font-bold text-2xl mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
            {isEnglish ? "Anatomical slices in AR" : "Cortes anatômicos em RA"}
          </h3>
          <p className="text-muted-foreground mb-4 leading-relaxed line-clamp-3">
            {isEnglish
              ? "Explore 3D MRI, CT, PET and PET/CT brain volumes. Move the phone or physical frame to sweep anatomical planes in real time — for training, not clinical diagnosis."
              : "Explore volumes 3D de RM, TC, PET e fusão PET/TC. Mova o celular ou a moldura física para varrer planos anatômicos em tempo real — para formação, não diagnóstico."}
          </p>
          <Button className="group-hover:shadow-lg transition-all">
            {isEnglish ? "Open AR lab" : "Abrir laboratório AR"}
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </Card>
  );

  const getLabIcon = (type: string) => {
    switch (type) {
      case "ultrasound":
        return <Waves className="h-24 w-24 text-primary/40 absolute" />;
      case "tens":
        return <Activity className="h-24 w-24 text-primary/40 absolute" />;
      case "ultrasound_therapy":
      case "ultrassom_terapeutico":
        return <Target className="h-24 w-24 text-primary/40 absolute" />;
      case "mri":
        return <Magnet className="h-24 w-24 text-primary/40 absolute" />;
      case "photobiomodulation":
        return <Sun className="h-24 w-24 text-primary/40 absolute" />;
      default:
        return <FlaskConical className="h-24 w-24 text-primary/40 absolute" />;
    }
  };

  const getLabTypeLabel = (type: string) => {
    const labels = {
      ultrasound: "Ultrassom",
      tens: "Eletroterapia TENS",
      ultrasound_therapy: "Ultrassom Terapêutico",
      mri: "Ressonância Magnética",
      photobiomodulation: "Fotobiomodulação",
      ultrassom_terapeutico: "Ultrassom Terapêutico",
      electrotherapy: "Eletroterapia",
      thermal: "Térmico",
      other: "Outro",
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (!isNativeApp) return null;

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

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-6">
        <FlaskConical className="h-6 w-6 text-primary" />
        <h2 className="text-3xl font-bold">Laboratórios Virtuais</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {arSliceCard}
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
                    <Target className="h-4 w-4" />
                  ) : lab.lab_type === "photobiomodulation" ? (
                    <Sun className="h-4 w-4" />
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
