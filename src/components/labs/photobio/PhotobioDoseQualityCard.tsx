import { classifyPhotobioDose, PHOTOBIO_DOSE_THRESHOLDS } from "@/lib/photobioOptics";
import { cn } from "@/lib/utils";
import { usePhotobioStore } from "@/stores/photobioStore";
import { usePhotobioInterpretation } from "./usePhotobioInterpretation";

const ZONE_META = [
  { zone: "subdose" as const, label: "Subdose", color: "bg-slate-400", range: `< ${PHOTOBIO_DOSE_THRESHOLDS.subdoseMax}` },
  {
    zone: "therapeutic" as const,
    label: "Janela terapêutica",
    color: "bg-emerald-500",
    range: `${PHOTOBIO_DOSE_THRESHOLDS.therapeuticMin}–${PHOTOBIO_DOSE_THRESHOLDS.therapeuticMax}`,
  },
  {
    zone: "transition" as const,
    label: "Transição",
    color: "bg-yellow-500",
    range: `${PHOTOBIO_DOSE_THRESHOLDS.therapeuticMax}–${PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMin}`,
  },
  {
    zone: "inhibitory" as const,
    label: "Inibição",
    color: "bg-sky-500",
    range: `${PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMin}–${PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMax}`,
  },
  {
    zone: "saturation" as const,
    label: "Saturação",
    color: "bg-red-500",
    range: `≥ ${PHOTOBIO_DOSE_THRESHOLDS.saturationMin}`,
  },
];

export function PhotobioDoseQualityCard() {
  const fluence = usePhotobioStore((s) => s.fluence());
  const { interaction } = usePhotobioInterpretation();
  const effective = interaction.effectiveFluence;
  const classification = classifyPhotobioDose(effective);
  const maxScale = PHOTOBIO_DOSE_THRESHOLDS.saturationMin + 10;
  const nominalPct = Math.min(100, (fluence / maxScale) * 100);
  const effectivePct = Math.min(100, (effective / maxScale) * 100);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Qualidade de dose (efetiva)</p>
        <p className="text-sm font-semibold mt-0.5">{classification.label}</p>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
        {ZONE_META.map((z, i) => {
          const prevMax =
            i === 0
              ? 0
              : i === 1
                ? PHOTOBIO_DOSE_THRESHOLDS.subdoseMax
                : i === 2
                  ? PHOTOBIO_DOSE_THRESHOLDS.therapeuticMax
                  : i === 3
                    ? PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMin
                    : PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMax;
          const nextMax =
            i === 0
              ? PHOTOBIO_DOSE_THRESHOLDS.subdoseMax
              : i === 1
                ? PHOTOBIO_DOSE_THRESHOLDS.therapeuticMax
                : i === 2
                  ? PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMin
                  : i === 3
                    ? PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMax
                    : maxScale;
          const left = (prevMax / maxScale) * 100;
          const width = ((nextMax - prevMax) / maxScale) * 100;
          return (
            <div
              key={z.zone}
              className={cn("absolute top-0 h-full opacity-40", z.color)}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground/50"
          style={{ left: `${nominalPct}%` }}
          title={`Nominal ${fluence.toFixed(1)} J/cm²`}
        />
        <div
          className="absolute top-0 h-full w-1 rounded-full bg-emerald-400 shadow"
          style={{ left: `${effectivePct}%`, transform: "translateX(-50%)" }}
          title={`Efetiva ${effective.toFixed(1)} J/cm²`}
        />
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>● nominal {fluence.toFixed(1)}</span>
        <span className="text-emerald-500 font-semibold">● efetiva {effective.toFixed(1)} J/cm²</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {ZONE_META.map((z) => (
          <div
            key={z.zone}
            className={cn(
              "rounded border px-2 py-1 text-[10px]",
              classification.zone === z.zone && "border-foreground/30 bg-muted/30 font-semibold",
            )}
          >
            <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", z.color)} />
            {z.label}
            <span className="block text-[9px] text-muted-foreground font-normal">{z.range} J/cm²</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Limiares unificados de <code className="text-[9px]">photobioOptics.ts</code>. A classificação usa
        fluência <strong>efetiva</strong> (técnica × nominal), não a fluência configurada isoladamente.
      </p>
    </div>
  );
}
