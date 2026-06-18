import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import { UltrasoundTherapy3DViewer } from "@/components/labs/ultrasound-therapy/UltrasoundTherapy3DViewer";
import { UltrasoundTherapyInsightsPanel } from "@/components/labs/ultrasound-therapy/UltrasoundTherapyInsightsPanel";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";

interface UltrasoundTherapyLabPreviewProps {
  config: UltrasoundTherapyConfig;
}

/** Preview 3D — usa config persistida (config_data), não estado local efêmero. */
export function UltrasoundTherapyLabPreview({ config }: UltrasoundTherapyLabPreviewProps) {
  const { initializeLab, setLabConfig } = useUltrasoundTherapyStore();

  useEffect(() => {
    initializeLab(config);
  }, [config, initializeLab]);

  useEffect(() => {
    setLabConfig(config);
  }, [config, setLabConfig]);

  useEffect(() => {
    return () => {
      useUltrasoundTherapyStore.getState().clear();
    };
  }, []);

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="w-full overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900 border-cyan-500/20 text-slate-100">
        <CardHeader className="border-b border-slate-800/60 py-3">
          <CardTitle className="text-base text-cyan-400">Simulador 3D Biomédico</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Reflete os defaults salvos. Alterações persistem ao salvar o lab.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative h-[500px] min-h-[500px] p-0">
          <UltrasoundTherapy3DViewer />
        </CardContent>
      </Card>

      <Card className="w-full overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900 border-blue-500/20 text-slate-100">
        <CardHeader className="border-b border-slate-800/60 py-3">
          <CardTitle className="text-base text-blue-400">Métricas e Segurança</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Análise de temperatura, energia e risco
          </CardDescription>
        </CardHeader>
        <CardContent className="dark p-0">
          <UltrasoundTherapyInsightsPanel embedded hideHeader />
        </CardContent>
      </Card>
    </div>
  );
}
