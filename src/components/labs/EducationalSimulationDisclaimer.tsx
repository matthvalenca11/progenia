import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface EducationalSimulationDisclaimerProps {
  className?: string;
  compact?: boolean;
}

/**
 * Aviso pedagógico padrão — simulação educacional, não precisão clínica.
 */
export function EducationalSimulationDisclaimer({
  className,
  compact = false,
}: EducationalSimulationDisclaimerProps) {
  if (compact) {
    return (
      <p
        className={cn(
          "text-[10px] leading-snug text-muted-foreground",
          className,
        )}
        role="note"
      >
        Simulação educacional — índices ilustrativos, não predição clínica.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2",
        className,
      )}
      role="note"
      aria-label="Aviso de simulação educacional"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Este laboratório usa um <strong className="font-medium text-foreground">modelo educacional simplificado</strong>.
        Os resultados são ilustrativos para aprendizado — não substituem avaliação clínica, protocolos
        prescritos ou simulação acústica/eletrônica de alta fidelidade.
      </p>
    </div>
  );
}
