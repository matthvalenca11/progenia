import { Badge } from "@/components/ui/badge";
import { usePhotobioStore } from "@/stores/photobioStore";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
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
    return "Ajuste a técnica de aplicação para manter dose homogênea.";
  };

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
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-red-400" />
            <p className="text-sm text-red-200">
              Atenção: irradiância acima de 500 mW/cm². Há risco térmico aumentado; reduzir potência ou aumentar área do spot.
            </p>
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

