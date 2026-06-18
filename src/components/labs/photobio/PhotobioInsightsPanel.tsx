import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePhotobioStore } from "@/stores/photobioStore";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useMemo } from "react";
import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const curveData = Array.from({ length: 121 }, (_, i) => {
  const x = i * 0.5; // 0..60
  const mu = 6;
  const sigmaLeft = 2.2;
  const sigmaRight = 10;
  const sigma = x <= mu ? sigmaLeft : sigmaRight;
  const y = Math.exp(-Math.pow(x - mu, 2) / (2 * sigma * sigma));
  return { fluence: Number(x.toFixed(2)), response: Number(y.toFixed(4)) };
});

function zoneColor(zone: string) {
  if (zone === "Janela Terapêutica Ativa") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (zone === "Efeito Inibitório / Sedação") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (zone === "Bioinibição / Saturação") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (zone === "Subdose / Efeito Nulo") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-foreground border-border";
}

function zoneMessage(zone: string) {
  switch (zone) {
    case "Janela Terapêutica Ativa":
      return "Nesta dose, o efeito predominante é a ativação da cadeia respiratória mitocondrial, com aumento de ATP e modulação de processos reparativos.";
    case "Efeito Inibitório / Sedação":
      return "Nesta faixa, predomina efeito neuromodulador com tendência analgésica e redução de excitabilidade, útil em protocolos de controle de dor.";
    case "Bioinibição / Saturação":
      return "A dose está além da janela terapêutica e pode gerar saturação biológica. Reavalie potência, tempo e área para evitar bioinibição.";
    case "Subdose / Efeito Nulo":
      return "Dose abaixo da janela efetiva. O efeito clínico tende a ser discreto ou ausente.";
    default:
      return "Dose em zona de transição entre janelas biológicas. Ajustes finos podem otimizar a resposta terapêutica.";
  }
}

export function PhotobioInsightsPanel() {
  const interaction = usePhotobioStore((s) => s.interaction);
  const fluence = usePhotobioStore((s) => s.fluence());
  const irradiance = usePhotobioStore((s) => s.irradiance());
  const mode = usePhotobioStore((s) => s.mode);
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const muscleFluence = usePhotobioStore((s) => s.interaction.muscleFluence);
  const muscleFluenceRatio = usePhotobioStore((s) => s.interaction.muscleFluenceRatio);
  const anatomyWarning = usePhotobioStore((s) => s.interaction.anatomyWarning);
  const techniqueWarnings = usePhotobioStore((s) => s.interaction.techniqueWarnings);
  const warningSuggestion = (warning: string) => {
    if (warning.includes("Movimento muito rápido")) {
      return "Diminua a velocidade de varredura para garantir a entrega da dose.";
    }
    if (warning.includes("Transdutor parado")) {
      return "Retome o scanning com deslocamento suave para evitar saturação local.";
    }
    if (warning.includes("Ângulo de incidência")) {
      return "Mantenha o transdutor perpendicular à pele (~90°) para máxima eficiência.";
    }
    if (warning.includes("Contato insuficiente")) {
      return "Aumente a pressão de contato para melhorar a transmissão de energia.";
    }
    if (warning.includes("Pressão excessiva")) {
      return "Reduza a pressão para evitar desconforto e concentração térmica.";
    }
    return "Ajuste a técnica de aplicação para manter dose homogênea.";
  };

  const doseMap = usePhotobioStore((s) => s.doseMap);
  const resetDoseMap = usePhotobioStore((s) => s.resetDoseMap);
  const hasDoseHistory = doseMap.some((d) => d > 0.5);
  const doseAnalysis = useMemo(() => {
    if (!hasDoseHistory) return null;
    const under = doseMap.filter((d) => d > 0.5 && d < 8).length;
    const optimal = doseMap.filter((d) => d >= 8 && d <= 25).length;
    const over = doseMap.filter((d) => d > 25).length;
    const untouched = doseMap.filter((d) => d <= 0.5).length;
    return { under, optimal, over, untouched, total: doseMap.length };
  }, [doseMap, hasDoseHistory]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Insights Biomédicos</h3>
        <Badge className={zoneColor(interaction.arndtSchulzZone)}>{interaction.arndtSchulzZone}</Badge>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground mb-2">Status terapêutico</p>
        <div className="flex items-start gap-2">
          {interaction.arndtSchulzZone === "Janela Terapêutica Ativa" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400" />
          ) : (
            <Info className="h-4 w-4 mt-0.5 text-sky-400" />
          )}
          <p className="text-sm leading-relaxed">{zoneMessage(interaction.arndtSchulzZone)}</p>
        </div>
      </div>

      {interaction.thermalWarning && (
        <div className="rounded-lg border-2 border-red-500/50 bg-red-500/15 p-3 animate-pulse">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-200">
                Risco térmico elevado — {irradiance.toFixed(0)} mW/cm²
              </p>
              <p className="text-xs text-red-100/90 mt-1">
                Irradiância acima de 500 mW/cm². Reduza potência ou aumente a área do spot.
              </p>
            </div>
          </div>
        </div>
      )}
      {anatomyWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-300" />
            <p className="text-sm text-amber-100">{anatomyWarning}</p>
          </div>
        </div>
      )}
      {hasDoseHistory && doseAnalysis && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Mapa de dose acumulada</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={resetDoseMap}>
              Limpar mapa
            </Button>
          </div>

          <div className="flex h-3 w-full overflow-hidden rounded-full border bg-muted/30">
            {doseMap.map((dose, i) => {
              const n = Math.min(1, dose / 30);
              const color =
                dose <= 0.5
                  ? "transparent"
                  : dose < 8
                    ? "#fbbf24"
                    : dose <= 25
                      ? "#22c55e"
                      : "#ef4444";
              return (
                <div
                  key={`dose-bar-${i}`}
                  className="h-full flex-1"
                  style={{
                    backgroundColor: color,
                    opacity: dose <= 0.5 ? 0.15 : 0.35 + n * 0.55,
                  }}
                  title={`Segmento ${i + 1}: ${dose.toFixed(1)}`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
              <span className="text-amber-300 font-semibold">{doseAnalysis.under}</span>
              <span className="text-muted-foreground"> subdosados</span>
            </div>
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
              <span className="text-emerald-300 font-semibold">{doseAnalysis.optimal}</span>
              <span className="text-muted-foreground"> na janela</span>
            </div>
            <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5">
              <span className="text-red-300 font-semibold">{doseAnalysis.over}</span>
              <span className="text-muted-foreground"> sobredosados</span>
            </div>
            <div className="rounded border bg-muted/30 px-2 py-1.5">
              <span className="font-semibold">{doseAnalysis.untouched}</span>
              <span className="text-muted-foreground"> não cobertos</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {doseAnalysis.over > doseAnalysis.optimal
              ? "A varredura concentrou dose excessiva em algumas regiões. Reduza potência ou aumente a velocidade de scanning."
              : doseAnalysis.under > doseAnalysis.optimal
                ? "Várias áreas ficaram subdosadas. Diminua a velocidade ou repita a passagem nessas regiões."
                : "Distribuição de dose relativamente homogênea ao longo da trajetória de scanning."}
          </p>
        </div>
      )}

      {techniqueWarnings.length > 0 && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 space-y-2">
          {techniqueWarnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-red-300 animate-pulse" />
              <div className="space-y-1">
                <p className="text-sm text-red-100 font-semibold animate-pulse">{warning}</p>
                <p className="text-xs text-orange-100">{warningSuggestion(warning)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Curva Arndt-Schulz</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <XAxis dataKey="fluence" type="number" tick={{ fontSize: 10 }} domain={[0, 60]} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 1.05]} />
              <Tooltip formatter={(v: number) => v.toFixed(3)} />
              <Line dataKey="response" stroke="#14b8a6" strokeWidth={2} dot={false} />
              <ReferenceDot x={Math.min(60, fluence)} y={curveData.reduce((closest, p) => {
                return Math.abs(p.fluence - fluence) < Math.abs(closest.fluence - fluence) ? p : closest;
              }, curveData[0]).response} r={5} fill="#f97316" stroke="#fff" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
        <div>
          <p className="text-muted-foreground">Comprimento de onda</p>
          <p className="font-semibold">{wavelength} nm</p>
        </div>
        <div>
          <p className="text-muted-foreground">Modo</p>
          <p className="font-semibold">{mode}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Irradiância</p>
          <p className="font-semibold">{irradiance.toFixed(2)} mW/cm²</p>
        </div>
        <div>
          <p className="text-muted-foreground">Fluência</p>
          <p className="font-semibold">{fluence.toFixed(3)} J/cm²</p>
        </div>
        <div>
          <p className="text-muted-foreground">Fluência no músculo</p>
          <p className="font-semibold">{muscleFluence.toFixed(3)} J/cm²</p>
        </div>
        <div>
          <p className="text-muted-foreground">Transmissão ao músculo</p>
          <p className="font-semibold">{(muscleFluenceRatio * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

