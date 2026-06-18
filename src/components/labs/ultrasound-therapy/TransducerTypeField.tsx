/**
 * Seletor de aplicador — taxonomia clínica (IEC 61689 / IEC 61828)
 */

import {
  CLINICAL_TRANSDUCER_TYPES,
  getTransducerDefinition,
  type TherapeuticTransducerDefinition,
  type TherapeuticTransducerType,
} from "@/config/therapeuticTransducerDefinitions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TransducerTypeFieldProps {
  value: TherapeuticTransducerType | string;
  onChange: (type: TherapeuticTransducerType) => void;
  disabled?: boolean;
  className?: string;
  showHelper?: boolean;
}

function TransducerOptionContent({ typeDef }: { typeDef: TherapeuticTransducerDefinition }) {
  return (
    <span className="min-w-0 truncate">
      <span className="font-medium">{typeDef.label}</span>
      {typeDef.standardRef && (
        <span className="ml-1.5 text-xs text-muted-foreground">· {typeDef.standardRef}</span>
      )}
    </span>
  );
}

export function TransducerTypeField({
  value,
  onChange,
  disabled,
  className,
  showHelper = true,
}: TransducerTypeFieldProps) {
  const def = getTransducerDefinition(value);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Aplicador terapêutico
      </Label>
      <Select
        value={def.id}
        disabled={disabled}
        onValueChange={(v) => onChange(v as TherapeuticTransducerType)}
      >
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Selecione o aplicador" />
        </SelectTrigger>
        <SelectContent>
          {CLINICAL_TRANSDUCER_TYPES.map((id) => {
            const typeDef = getTransducerDefinition(id);
            return (
              <SelectItem key={id} value={id} className="py-2.5 pl-9">
                <TransducerOptionContent typeDef={typeDef} />
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {showHelper && (
        <p className="text-xs text-muted-foreground">{def.subtitle}</p>
      )}
    </div>
  );
}

/** Opções compactas para ToggleGroup (2 tipos clínicos) */
export function getTransducerToggleOptions() {
  return CLINICAL_TRANSDUCER_TYPES.map((id) => {
    const def = getTransducerDefinition(id);
    return {
      value: id,
      label: def.shortLabel,
      title: def.label,
    };
  });
}

/** Cards visuais para painel do aluno */
export function TransducerTypeVisualPicker({
  value,
  onChange,
  compact = false,
}: {
  value: TherapeuticTransducerType | string;
  onChange: (type: TherapeuticTransducerType) => void;
  compact?: boolean;
}) {
  const current = getTransducerDefinition(value);

  return (
    <div className="grid grid-cols-2 gap-2">
      {CLINICAL_TRANSDUCER_TYPES.map((id) => {
        const typeDef = getTransducerDefinition(id);
        const active = current.id === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border px-2 text-center transition-colors",
              compact ? "py-2.5" : "py-3",
              active
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-background hover:bg-muted/60",
            )}
          >
            <span className={cn("text-xs font-semibold leading-tight", active && "text-primary")}>
              {typeDef.shortLabel}
            </span>
            {!compact && (
              <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                {typeDef.standardRef ?? typeDef.subtitle.split("·")[0]?.trim()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
