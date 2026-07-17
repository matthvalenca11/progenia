/**
 * Preview estático — quais controles o aluno verá (controlModes).
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PhotobioControlModes, PhotobioLabConfig } from "@/types/photobioLabConfig";
import {
  PHOTOBIO_APPLICATOR_LABELS,
  PHOTOBIO_TARGET_TISSUE_LABELS,
} from "@/types/photobioLabConfig";
import { Eye, EyeOff } from "lucide-react";

const CONTROL_ITEMS: Array<{
  key: keyof PhotobioControlModes;
  label: string;
  hint: string;
  defaultOn?: boolean;
}> = [
  { key: "showWavelength", label: "Comprimento de onda", hint: "660 vs 808 nm" },
  { key: "showPower", label: "Potência", hint: "mW" },
  { key: "showSpotSize", label: "Área do spot", hint: "cm²" },
  { key: "showExposureTime", label: "Tempo de exposição", hint: "segundos" },
  { key: "showMode", label: "Modo CW/Pulsed", hint: "Contínuo ou pulsado" },
  { key: "showDutyCycle", label: "Duty cycle", hint: "Visível se modo pulsado" },
  { key: "showTechnique", label: "Técnica", hint: "Ângulo, pressão, varredura" },
  { key: "showAnatomyPresets", label: "Presets anatômicos", hint: "Padrão, idoso, atleta, obeso" },
  { key: "showCustomAnatomy", label: "Anatomia customizada", hint: "Espessuras por camada" },
  { key: "showMelanin", label: "Índice de melanina", hint: "Absorção superficial", defaultOn: false },
  { key: "showApplicatorType", label: "Tipo de aplicador", hint: "Cluster, laser, painel", defaultOn: false },
];

function isVisible(
  controlModes: PhotobioControlModes,
  key: keyof PhotobioControlModes,
  defaultOn = true,
): boolean {
  const mode = controlModes[key];
  return mode === undefined ? defaultOn : mode === "show";
}

interface PhotobioStudentControlsPreviewProps {
  config: PhotobioLabConfig;
}

export function PhotobioStudentControlsPreview({ config }: PhotobioStudentControlsPreviewProps) {
  const visible = CONTROL_ITEMS.filter((item) =>
    isVisible(config.controlModes, item.key, item.defaultOn),
  );
  const hidden = CONTROL_ITEMS.filter(
    (item) => !isVisible(config.controlModes, item.key, item.defaultOn),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modo aluno — preview</CardTitle>
        <CardDescription>
          Controles que o aluno poderá ajustar. Valores iniciais vêm dos defaults salvos em{" "}
          <code className="text-xs">config_data</code>.
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
              {config.wavelength} nm · {config.power} mW · spot {config.spotSize.toFixed(2)} cm² ·{" "}
              {config.exposureTime}s
            </li>
            <li>
              {config.mode === "Pulsed" ? `Pulsado ${config.dutyCycle}%` : "CW"} ·{" "}
              {PHOTOBIO_APPLICATOR_LABELS[config.applicatorType]}
            </li>
            <li>
              Ângulo {config.transducerAngle}° · pressão {config.contactPressure}% · alvo{" "}
              {PHOTOBIO_TARGET_TISSUE_LABELS[config.targetTissue]}
            </li>
            <li>
              Anatomia {config.anatomyPreset} · melanina {(config.skinMelaninIndex * 100).toFixed(0)}% · aba{" "}
              {config.viewerTab}
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px]">
          {config.featureFlags.showGuidedMode && (
            <Badge variant="outline">Modo guiado</Badge>
          )}
          {config.featureFlags.showSnapshots && <Badge variant="outline">Snapshots A/B</Badge>}
          {config.featureFlags.showAdvancedPhysics && (
            <Badge variant="outline">Física avançada</Badge>
          )}
          {config.featureFlags.showClinicalPresets && (
            <Badge variant="outline">Presets clínicos</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
