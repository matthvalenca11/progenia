import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { usePhotobioStore } from "@/stores/photobioStore";

function LayerSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground">{value.toFixed(1)} mm</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0] ?? value)} />
    </div>
  );
}

interface AnatomyControlsProps {
  showPresets: boolean;
  showCustom: boolean;
  disabled?: boolean;
}

export function AnatomyControls({
  showPresets,
  showCustom,
  disabled = false,
}: AnatomyControlsProps) {
  const anatomyPreset = usePhotobioStore((s) => s.anatomyPreset);
  const layerConfig = usePhotobioStore((s) => s.layerConfig);
  const setAnatomyPreset = usePhotobioStore((s) => s.setAnatomyPreset);
  const setCustomLayerThickness = usePhotobioStore((s) => s.setCustomLayerThickness);
  const [openCustom, setOpenCustom] = useState(anatomyPreset === "custom");

  if (!showPresets && !showCustom) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Preset Anatômico</p>
        <p className="text-xs text-muted-foreground">Selecione o perfil de tecido do paciente.</p>
      </div>

      {showPresets && (
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={anatomyPreset === "default" ? "default" : "outline"} size="sm" onClick={() => setAnatomyPreset("default")} disabled={disabled}>
          Padrão
        </Button>
        <Button type="button" variant={anatomyPreset === "elderly" ? "default" : "outline"} size="sm" onClick={() => setAnatomyPreset("elderly")} disabled={disabled}>
          Idoso
        </Button>
        <Button type="button" variant={anatomyPreset === "athlete" ? "default" : "outline"} size="sm" onClick={() => setAnatomyPreset("athlete")} disabled={disabled}>
          Atleta
        </Button>
        <Button type="button" variant={anatomyPreset === "obese" ? "default" : "outline"} size="sm" onClick={() => setAnatomyPreset("obese")} disabled={disabled}>
          Obeso
        </Button>
      </div>
      )}

      {showCustom && (
      <Button
        type="button"
        variant={openCustom || anatomyPreset === "custom" ? "default" : "secondary"}
        size="sm"
        className="w-full"
        onClick={() => {
          setOpenCustom((prev) => !prev);
          setAnatomyPreset("custom");
        }}
        disabled={disabled}
      >
        Personalizar Anatomia
      </Button>
      )}

      {showCustom && (openCustom || anatomyPreset === "custom") && (
        <div className={`space-y-3 rounded-md border bg-card p-3 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <LayerSlider
            label="Epiderme"
            value={layerConfig.epidermisMm}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(v) => setCustomLayerThickness("epidermisMm", v)}
          />
          <LayerSlider
            label="Derme"
            value={layerConfig.dermisMm}
            min={0.5}
            max={10}
            step={0.1}
            onChange={(v) => setCustomLayerThickness("dermisMm", v)}
          />
          <LayerSlider
            label="Adiposo"
            value={layerConfig.adiposeMm}
            min={1}
            max={60}
            step={0.5}
            onChange={(v) => setCustomLayerThickness("adiposeMm", v)}
          />
          <LayerSlider
            label="Músculo"
            value={layerConfig.muscleMm}
            min={5}
            max={60}
            step={0.5}
            onChange={(v) => setCustomLayerThickness("muscleMm", v)}
          />
        </div>
      )}
    </div>
  );
}

