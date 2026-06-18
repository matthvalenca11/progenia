/**
 * Preview estático — quais controles o aluno verá (enabledControls).
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import { Eye, EyeOff } from "lucide-react";

const CONTROL_ITEMS: Array<{
  key: keyof UltrasoundTherapyConfig["enabledControls"];
  label: string;
  hint: string;
  defaultOn?: boolean;
}> = [
  { key: "scenario", label: "Cenário anatômico", hint: "Ombro, joelho, personalizado…" },
  { key: "customThicknesses", label: "Espessuras personalizadas", hint: "Camadas STACK no cenário custom", defaultOn: true },
  { key: "mixedLayer", label: "Camada mista", hint: "Divisão osso/músculo", defaultOn: false },
  { key: "transducerType", label: "Aplicador terapêutico", hint: "Planar (IEC 61689) ou focalizado (IEC 61828)", defaultOn: true },
  { key: "beamProfile", label: "Perfil do feixe", hint: "Plano ou convergente focalizado", defaultOn: true },
  { key: "focusDepth", label: "Profundidade focal", hint: "Zona focal do aplicador convergente", defaultOn: true },
  { key: "frequency", label: "Frequência", hint: "MHz" },
  { key: "era", label: "ERA", hint: "Área efetiva cm²" },
  { key: "mode", label: "Modo", hint: "Contínuo / pulsado" },
  { key: "dutyCycle", label: "Duty cycle", hint: "Só visível se modo = pulsado" },
  { key: "intensity", label: "Intensidade", hint: "W/cm²" },
  { key: "duration", label: "Duração", hint: "Minutos" },
  { key: "coupling", label: "Acoplamento", hint: "Gel bom / ruim" },
  { key: "movement", label: "Movimento", hint: "Parado / varredura" },
  { key: "tissuePerfusionProfile", label: "Perfusão tecidual", hint: "Dissipação térmica", defaultOn: true },
];

function isEnabled(
  enabledControls: UltrasoundTherapyConfig["enabledControls"],
  key: keyof UltrasoundTherapyConfig["enabledControls"],
  defaultOn = true,
): boolean {
  const v = enabledControls[key];
  return v === undefined ? defaultOn : Boolean(v);
}

interface TherapyStudentControlsPreviewProps {
  config: UltrasoundTherapyConfig;
}

export function TherapyStudentControlsPreview({ config }: TherapyStudentControlsPreviewProps) {
  const visible = CONTROL_ITEMS.filter((item) =>
    isEnabled(config.enabledControls, item.key, item.defaultOn),
  );
  const hidden = CONTROL_ITEMS.filter(
    (item) => !isEnabled(config.enabledControls, item.key, item.defaultOn),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modo aluno — preview</CardTitle>
        <CardDescription>
          Controles que o aluno poderá ajustar. Valores iniciais vêm dos defaults salvos em{" "}
          <code className="text-xs">config_data</code> — este painel não altera a configuração.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visíveis ({visible.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {visible.map((item) => (
              <Badge key={item.key} variant="default" className="gap-1">
                <Eye className="h-3 w-3" />
                {item.label}
              </Badge>
            ))}
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum controle liberado.</p>
            )}
          </div>
        </div>

        {hidden.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ocultos / fixos ({hidden.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {hidden.map((item) => (
                <Badge key={item.key} variant="secondary" className="gap-1 opacity-70">
                  <EyeOff className="h-3 w-3" />
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Defaults ativos ao abrir o lab</p>
          <ul className="mt-2 space-y-1 font-mono tabular-nums">
            <li>
              {config.transducerType} · {config.beamProfile} · foco {config.focusDepth?.toFixed(1) ?? "—"} cm
            </li>
            <li>
              {config.frequency.toFixed(1)} MHz · ERA {config.era.toFixed(1)} cm² · {config.intensity.toFixed(1)} W/cm²
            </li>
            <li>
              {config.mode === "pulsed" ? `Pulsado ${config.dutyCycle}%` : "Contínuo"} · {config.duration} min
            </li>
            <li>
              Acopl. {config.coupling} · {config.movement} · perfusão {config.tissuePerfusionProfile}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
