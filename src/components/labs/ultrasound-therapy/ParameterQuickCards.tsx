/**
 * Cards compactos de parâmetros com status visual e microexplicações.
 */

import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import {
  CLINICAL_TRANSDUCER_TYPES,
  getTransducerDefinition,
  isFocusDepthApplicable,
} from "@/config/therapeuticTransducerDefinitions";
import {
  TRANSDUCER_BEAM_PROFILE_LABELS,
  TherapeuticTransducerType,
  TransducerBeamProfile,
} from "@/types/ultrasoundTherapyConfig";
import {
  STATUS_STYLES,
  statusForCoupling,
  statusForDuration,
  statusForFrequency,
  statusForIntensity,
  statusForMode,
  statusForMovement,
  type ParamStatus,
} from "./therapyUxHelpers";
import { cn } from "@/lib/utils";
import { utHint } from "./ultrasoundTherapyUi";

interface QuickCardProps {
  title: string;
  value: string;
  hint: string;
  status: ParamStatus;
  disabled?: boolean;
  children?: React.ReactNode;
}

function QuickCard({ title, value, hint, status, disabled, children }: QuickCardProps) {
  const styles = STATUS_STYLES[status];
  const body = (
    <div
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        styles.border,
        styles.bg,
        disabled ? "pointer-events-none opacity-40" : "cursor-pointer hover:brightness-[1.02]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", styles.dot)} title={styles.label} />
      </div>
      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">{value}</p>
      <p className={cn("mt-1 line-clamp-2 leading-snug", utHint)}>{hint}</p>
    </div>
  );

  if (!children || disabled) return body;

  return (
    <Popover>
      <PopoverTrigger asChild>{body}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="text-sm font-semibold">{title}</p>
        <p className={utHint}>{hint}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function SegmentEdit({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-medium",
            value === opt.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ParameterQuickCards({ compact = false }: { compact?: boolean }) {
  const { config, updateConfig, flushSimulation, simulationResult, effectiveCoupling } =
    useUltrasoundTherapyStore();
  const commitSim = () => flushSimulation();
  const ec = config.enabledControls;
  const focusDepthEnabled = isFocusDepthApplicable(config.transducerType, config.beamProfile);

  const couplingLabel =
    config.coupling === "poor"
      ? "Ruim"
      : effectiveCoupling === "good"
        ? "Bom gel"
        : "Sem gel local";

  const couplingHint =
    config.coupling === "poor"
      ? "Acoplamento ruim reduz transmissão e aumenta aquecimento superficial."
      : effectiveCoupling === "good"
        ? "Gel adequado sob o transdutor transmite energia ao tecido."
        : "Posição sem gel — perde acoplamento e aquece mais a superfície.";

  const freqHint =
    config.frequency <= 1.5
      ? "1 MHz penetra mais profundamente; ideal para alvo muscular profundo."
      : config.frequency >= 2.5
        ? "3 MHz concentra energia na superfície — pele e tecidos rasos."
        : "Frequência intermediária equilibra penetração e aquecimento local.";

  const cards = (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3",
      )}
    >
      {ec.frequency !== false && (
        <QuickCard
          title="Frequência"
          value={`${config.frequency.toFixed(1)} MHz`}
          hint={freqHint}
          status={statusForFrequency(config, simulationResult)}
        >
          <Slider
            value={[config.frequency]}
            min={config.ranges.frequency.min}
            max={config.ranges.frequency.max}
            step={0.1}
            onValueChange={(v) => updateConfig({ frequency: v[0] })}
            onValueCommit={commitSim}
          />
        </QuickCard>
      )}

      {ec.intensity && (
        <QuickCard
          title="Intensidade"
          value={`${config.intensity.toFixed(1)} W/cm²`}
          hint="Potência por área — valores altos com transdutor parado aumentam risco de hotspot."
          status={statusForIntensity(config, simulationResult)}
        >
          <Slider
            value={[config.intensity]}
            min={config.ranges.intensity.min}
            max={config.ranges.intensity.max}
            step={0.1}
            onValueChange={(v) => updateConfig({ intensity: v[0] })}
            onValueCommit={commitSim}
          />
        </QuickCard>
      )}

      {ec.mode && (
        <QuickCard
          title="Modo"
          value={config.mode === "continuous" ? "Contínuo" : "Pulsado"}
          hint={
            config.mode === "continuous"
              ? "Aquecimento contínuo — típico para efeito térmico terapêutico."
              : "Pulsado reduz média térmica; ritmo influencia cavitação ilustrativa."
          }
          status={statusForMode(config)}
        >
          <SegmentEdit
            value={config.mode}
            onChange={(v) => updateConfig({ mode: v as "continuous" | "pulsed" })}
            options={[
              { value: "continuous", label: "Contínuo" },
              { value: "pulsed", label: "Pulsado" },
            ]}
          />
        </QuickCard>
      )}

      {ec.dutyCycle && config.mode === "pulsed" && (
        <QuickCard
          title="Duty cycle"
          value={`${config.dutyCycle}%`}
          hint="Porcentagem do tempo em emissão — menor duty reduz calor médio."
          status="ok"
        >
          <Slider
            value={[config.dutyCycle]}
            min={config.ranges.dutyCycle.min}
            max={config.ranges.dutyCycle.max}
            step={5}
            onValueChange={(v) => updateConfig({ dutyCycle: v[0] })}
            onValueCommit={commitSim}
          />
        </QuickCard>
      )}

      {ec.duration && (
        <QuickCard
          title="Duração"
          value={`${config.duration} min`}
          hint="Tempo total de aplicação — doses longas elevam risco térmico acumulado."
          status={statusForDuration(config, simulationResult)}
        >
          <Slider
            value={[config.duration]}
            min={config.ranges.duration.min}
            max={config.ranges.duration.max}
            step={1}
            onValueChange={(v) => updateConfig({ duration: v[0] })}
            onValueCommit={commitSim}
          />
        </QuickCard>
      )}

      {ec.coupling && (
        <QuickCard
          title="Acoplamento"
          value={couplingLabel}
          hint={couplingHint}
          status={statusForCoupling(config, simulationResult, effectiveCoupling)}
        >
          <SegmentEdit
            value={config.coupling}
            onChange={(v) => updateConfig({ coupling: v as "good" | "poor" })}
            options={[
              { value: "good", label: "Bom" },
              { value: "poor", label: "Ruim" },
            ]}
          />
        </QuickCard>
      )}

      {ec.movement && (
        <QuickCard
          title="Movimento"
          value={config.movement === "scanning" ? "Varredura" : "Parado"}
          hint={
            config.movement === "scanning"
              ? "Varredura distribui energia e reduz picos térmicos."
              : "Movimento estacionário aumenta risco de hotspot localizado."
          }
          status={statusForMovement(config)}
        >
          <SegmentEdit
            value={config.movement}
            onChange={(v) => updateConfig({ movement: v as "stationary" | "scanning" })}
            options={[
              { value: "stationary", label: "Parado" },
              { value: "scanning", label: "Varredura" },
            ]}
          />
        </QuickCard>
      )}

      {ec.transducerType !== false && (
        <QuickCard
          title="Transdutor"
          value={getTransducerDefinition(config.transducerType ?? "planar_circular").label}
          hint={getTransducerDefinition(config.transducerType ?? "planar_circular").subtitle}
          status="ok"
        >
          <div className="grid grid-cols-1 gap-1.5">
            {CLINICAL_TRANSDUCER_TYPES.map((id) => {
              const typeDef = getTransducerDefinition(id);
              return (
              <button
                key={id}
                type="button"
                onClick={() => updateConfig({ transducerType: id })}
                className={cn(
                  "rounded-lg border px-2 py-2 text-left text-xs",
                  config.transducerType === id
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="font-medium">{typeDef.shortLabel}</span>
              </button>
              );
            })}
          </div>
        </QuickCard>
      )}

      {ec.beamProfile !== false &&
        ec.focusDepth !== false &&
        focusDepthEnabled && (
          <QuickCard
            title="Foco"
            value={`${(config.focusDepth ?? 2.5).toFixed(1)} cm`}
            hint={`Perfil ${TRANSDUCER_BEAM_PROFILE_LABELS[config.beamProfile ?? "planar"]} — concentra energia na profundidade escolhida.`}
            status="ok"
          >
            <Slider
              value={[config.focusDepth ?? 2.5]}
              min={config.ranges.focusDepth?.min ?? 1}
              max={config.ranges.focusDepth?.max ?? 5}
              step={0.1}
              onValueChange={(v) => updateConfig({ focusDepth: v[0] })}
              onValueCommit={commitSim}
            />
          </QuickCard>
        )}

      {ec.beamProfile !== false &&
        !getTransducerDefinition(config.transducerType ?? "planar_circular").lockBeamProfile && (
          <QuickCard
            title="Perfil do feixe"
            value={TRANSDUCER_BEAM_PROFILE_LABELS[config.beamProfile ?? "planar"]}
            hint="Plano espalha de forma previsível; focalizado concentra no alvo."
            status="ok"
          >
            <SegmentEdit
              value={config.beamProfile ?? "planar"}
              onChange={(v) => updateConfig({ beamProfile: v as TransducerBeamProfile })}
              options={[
                { value: "planar", label: "Plano" },
                { value: "focused", label: "Focalizado" },
              ]}
            />
          </QuickCard>
        )}
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Ajustes rápidos
      </p>
      {cards}
      <p className={utHint}>Toque em um card para ajustar. Verde = adequado · Amarelo = atenção · Vermelho = risco.</p>
    </div>
  );
}
