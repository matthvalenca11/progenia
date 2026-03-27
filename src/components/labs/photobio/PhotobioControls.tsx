import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePhotobioStore } from "@/stores/photobioStore";
import { AnatomyControls } from "./AnatomyControls";

function ControlRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-2 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(v[0] ?? value)}
          disabled={disabled}
        />
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function PhotobioControls() {
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const mode = usePhotobioStore((s) => s.mode);
  const power = usePhotobioStore((s) => s.power);
  const spotSize = usePhotobioStore((s) => s.spotSize);
  const exposureTime = usePhotobioStore((s) => s.exposureTime);
  const dutyCycle = usePhotobioStore((s) => s.dutyCycle);
  const irradiance = usePhotobioStore((s) => s.irradiance());
  const energy = usePhotobioStore((s) => s.energy());
  const fluence = usePhotobioStore((s) => s.fluence());

  const setWavelength = usePhotobioStore((s) => s.setWavelength);
  const setMode = usePhotobioStore((s) => s.setMode);
  const setPower = usePhotobioStore((s) => s.setPower);
  const setSpotSize = usePhotobioStore((s) => s.setSpotSize);
  const setExposureTime = usePhotobioStore((s) => s.setExposureTime);
  const setDutyCycle = usePhotobioStore((s) => s.setDutyCycle);
  const resetDefaults = usePhotobioStore((s) => s.resetDefaults);
  const controlModes = usePhotobioStore((s) => s.controlModes);
  const modeOf = (key: keyof typeof controlModes) => controlModes[key] ?? "show";
  const shouldHide = (key: keyof typeof controlModes) => modeOf(key) === "hidden";
  const shouldDisable = (key: keyof typeof controlModes) => modeOf(key) === "disabled";

  return (
    <div className="space-y-5 p-4">
      {!shouldHide("showWavelength") && (
      <div className={`space-y-2 ${shouldDisable("showWavelength") ? "opacity-50" : ""}`}>
        <Label className="text-sm">Comprimento de onda</Label>
        <Tabs value={String(wavelength)} onValueChange={(v) => setWavelength(Number(v) as 660 | 808)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="660" disabled={shouldDisable("showWavelength")}>660 nm (Vermelho)</TabsTrigger>
            <TabsTrigger value="808" disabled={shouldDisable("showWavelength")}>808 nm (Infravermelho)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      )}

      {!shouldHide("showMode") && (
      <div className={`space-y-2 ${shouldDisable("showMode") ? "opacity-50" : ""}`}>
        <Label className="text-sm">Modo</Label>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "CW" | "Pulsed")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="CW" disabled={shouldDisable("showMode")}>CW</TabsTrigger>
            <TabsTrigger value="Pulsed" disabled={shouldDisable("showMode")}>Pulsed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      )}

      {!shouldHide("showPower") && (
        <ControlRow label="Potência" value={power} unit=" mW" min={10} max={500} step={1} onChange={setPower} disabled={shouldDisable("showPower")} />
      )}
      {!shouldHide("showSpotSize") && (
        <ControlRow label="Área do spot" value={spotSize} unit=" cm²" min={0.1} max={1.0} step={0.01} onChange={setSpotSize} disabled={shouldDisable("showSpotSize")} />
      )}
      {!shouldHide("showExposureTime") && (
        <ControlRow label="Tempo de exposição" value={exposureTime} unit=" s" min={1} max={300} step={1} onChange={setExposureTime} disabled={shouldDisable("showExposureTime")} />
      )}

      {mode === "Pulsed" && !shouldHide("showMode") && (
        <ControlRow label="Duty cycle" value={dutyCycle} unit=" %" min={1} max={100} step={1} onChange={setDutyCycle} disabled={shouldDisable("showMode")} />
      )}

      {(!shouldHide("showAnatomyPresets") || !shouldHide("showCustomAnatomy")) && (
      <AnatomyControls
        showPresets={!shouldHide("showAnatomyPresets")}
        showCustom={!shouldHide("showCustomAnatomy")}
        disabled={shouldDisable("showAnatomyPresets") && shouldDisable("showCustomAnatomy")}
      />
      )}

      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
        <div className="space-y-1">
          <p className="text-muted-foreground">Irradiância</p>
          <p className="font-semibold">{irradiance.toFixed(2)} mW/cm²</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Energia</p>
          <p className="font-semibold">{energy.toFixed(3)} J</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Fluência</p>
          <p className="font-semibold">{fluence.toFixed(3)} J/cm²</p>
        </div>
      </div>

      <button
        type="button"
        onClick={resetDefaults}
        className="w-full rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        Resetar parâmetros
      </button>
    </div>
  );
}

