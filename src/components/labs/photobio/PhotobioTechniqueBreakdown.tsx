import { formatPhotobioFraction } from "@/lib/photobioOptics";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhotobioInterpretation } from "./usePhotobioInterpretation";

function factorBar(label: string, value: number, hint?: string, emphasizeHigh = false) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const ok = emphasizeHigh ? value >= 0.85 : value >= 0.5 && value <= 0.95;
  return (
    <div key={label} className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono font-semibold tabular-nums", ok ? "text-emerald-500" : "text-amber-500")}>
          {formatPhotobioFraction(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn("h-full rounded-full transition-all", ok ? "bg-emerald-500" : "bg-amber-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="text-[9px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PhotobioTechniqueBreakdown() {
  const { interaction, techniqueSuggestions } = usePhotobioInterpretation();

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Decomposição técnica da dose</p>

      <div className="space-y-2.5">
        {factorBar(
          "Fração absorvida (epiderme + derme)",
          interaction.superficialAbsorptionIndex,
          "Beer–Lambert — sobe com melanina, especialmente em 660 nm",
        )}
        {factorBar(
          "Transmissão ao plano muscular (stack)",
          interaction.deepDeliveryIndex,
          "Sem acoplamento de contato — cai com melanina e adiposidade",
        )}
        {factorBar("Eficiência angular (θ≈90°)", interaction.angleEfficiency, "cos(θ) — perpendicularidade", true)}
        {factorBar("Fator de pressão", interaction.pressureFactor, "Contato óptico mecânico", true)}
        {factorBar("Fator de velocidade", interaction.speedFactor, "Varredura vs. repouso", true)}
        {factorBar(
          "Acoplamento óptico",
          interaction.contactOpticalCoupling,
          "Transmissão ar/pele — não é gel de ultrassom",
          true,
        )}
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-emerald-700 dark:text-emerald-300">realDoseFactor</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {(interaction.realDoseFactor * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-[9px] text-muted-foreground">
            ângulo × pressão × velocidade → multiplica fluência nominal
          </p>
        </div>
      </div>

      {interaction.penetrationProfile.length > 0 && (
        <div className="rounded border bg-muted/20 p-2.5 space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground">Absorção por região (penetrationProfile)</p>
          {interaction.penetrationProfile.map((row) => (
            <div key={row.layer} className="flex items-center justify-between text-[10px]">
              <span className="capitalize text-muted-foreground">
                {row.layer === "epidermis_dermis" ? "Epiderme + derme" : row.layer === "hypodermis" ? "Adiposo" : "Músculo"}
              </span>
              <span className="font-mono font-semibold">{(row.absorbedFraction * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      {techniqueSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Lightbulb className="h-3 w-3" /> Sugestões acionáveis
          </p>
          {techniqueSuggestions.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-start gap-2 rounded border px-2 py-1.5 text-[11px]",
                s.priority === "high"
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-border bg-muted/20",
              )}
            >
              {s.priority === "high" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="leading-snug text-muted-foreground">{s.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
