/**
 * Botão para salvar snapshot da simulação PBM atual.
 */

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePhotobioStore } from "@/stores/photobioStore";
import { suggestPhotobioSnapshotLabel } from "@/lib/photobioComparison";
import { cn } from "@/lib/utils";

interface PhotobioSnapshotButtonProps {
  compact?: boolean;
  className?: string;
}

export function PhotobioSnapshotButton({ compact = false, className }: PhotobioSnapshotButtonProps) {
  const saveSnapshot = usePhotobioStore((s) => s.saveSnapshot);
  const snapshots = usePhotobioStore((s) => s.snapshots);
  const state = usePhotobioStore();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");

  const suggested = suggestPhotobioSnapshotLabel({
    wavelength: state.wavelength,
    power: state.power,
    spotSize: state.spotSize,
    exposureTime: state.exposureTime,
    mode: state.mode,
    dutyCycle: state.dutyCycle,
    transducerAngle: state.transducerAngle,
    contactPressure: state.contactPressure,
    isDragging: state.isDragging,
    draggingSpeed: state.draggingSpeed,
    anatomyPreset: state.anatomyPreset,
    applicatorType: state.applicatorType,
  });

  const handleSave = (customLabel?: string) => {
    saveSnapshot(customLabel);
    setLabel("");
    setOpen(false);
  };

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={() => handleSave()}
        aria-label="Salvar snapshot"
        title={`Salvar: ${suggested}`}
      >
        <BookmarkPlus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", className)}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Salvar snapshot
          {snapshots.length > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0 text-[10px] font-mono">
              {snapshots.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <p className="text-xs font-medium text-foreground">Nome do snapshot</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sugestão: <span className="font-medium text-foreground">{suggested}</span>
        </p>
        <Input
          className="mt-3 h-9 text-sm"
          placeholder={suggested}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave(label || undefined);
          }}
        />
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => handleSave(label || undefined)}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
