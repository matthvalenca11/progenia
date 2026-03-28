import { Beaker } from "lucide-react";
import type { VirtualLab } from "@/services/virtualLabService";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";
import TensLabPage from "@/pages/TensLabPage";
import UltrasoundTherapyLabPage from "@/pages/UltrasoundTherapyLabPage";
import MRILabPage from "@/pages/MRILabPage";
import type { MRILabConfig } from "@/types/mriLabConfig";
import PhotobioLabPage from "@/pages/PhotobioLabPage";

/**
 * Renderiza o simulador inline (igual ao diálogo "Testar" do admin).
 * `config_data` ausente vira `{}` para os labs tolerarem preview vazio.
 */
export function LabPreviewContent({ lab }: { lab: VirtualLab }) {
  const labType = String(lab.lab_type || "").trim().toLowerCase();
  const config = (lab.config_data ?? {}) as Record<string, unknown>;

  if (labType === "ultrasound") {
    return <UltrasoundUnifiedLab config={config} />;
  }

  if (labType === "tens") {
    return (
      <div className="rounded-xl border bg-muted/30 p-2 sm:p-4">
        <TensLabPage config={config} />
      </div>
    );
  }

  if (labType === "ultrasound_therapy" || labType === "ultrassom_terapeutico") {
    return (
      <div className="rounded-xl border bg-muted/30 p-2 sm:p-4">
        <UltrasoundTherapyLabPage config={config} />
      </div>
    );
  }

  if (labType === "mri") {
    return (
      <div className="rounded-xl border bg-muted/30 p-2 sm:p-4">
        <MRILabPage config={config as unknown as MRILabConfig} />
      </div>
    );
  }

  if (labType === "photobiomodulation" || labType === "fbm") {
    return (
      <div className="rounded-xl border bg-muted/30 p-2 sm:p-4">
        <PhotobioLabPage config={config} />
      </div>
    );
  }

  if (labType === "electrotherapy") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Beaker className="mx-auto mb-4 h-16 w-16 opacity-50" />
        <p className="text-lg font-medium">Simulador de eletroterapia em desenvolvimento</p>
        <p className="mt-2 text-sm">Em breve você poderá testar este tipo de laboratório</p>
      </div>
    );
  }

  if (labType === "thermal") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Beaker className="mx-auto mb-4 h-16 w-16 opacity-50" />
        <p className="text-lg font-medium">Simulador térmico em desenvolvimento</p>
        <p className="mt-2 text-sm">Em breve você poderá testar este tipo de laboratório</p>
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-muted-foreground">
      <Beaker className="mx-auto mb-4 h-16 w-16 opacity-50" />
      <p className="text-lg font-medium">Tipo de laboratório não reconhecido</p>
      <p className="mt-2 text-sm">Verifique a configuração do laboratório</p>
    </div>
  );
}
