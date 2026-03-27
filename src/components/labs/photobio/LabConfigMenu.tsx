import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePhotobioStore } from "@/stores/photobioStore";

export function LabConfigMenu() {
  const controlModes = usePhotobioStore((s) => s.controlModes);
  const setControlMode = usePhotobioStore((s) => s.setControlMode);

  const items: Array<{ key: keyof typeof controlModes; label: string }> = [
    { key: "showWavelength", label: "Comprimento de onda" },
    { key: "showPower", label: "Potência" },
    { key: "showSpotSize", label: "Área do spot" },
    { key: "showExposureTime", label: "Tempo de exposição" },
    { key: "showMode", label: "Modo (CW/Pulsed)" },
    { key: "showAnatomyPresets", label: "Presets anatômicos" },
    { key: "showCustomAnatomy", label: "Anatomia customizada" },
  ];

  return (
    <div className="absolute right-4 top-16 z-20 w-80 rounded-lg border bg-card p-4 shadow-xl">
      <p className="text-sm font-semibold">Configuração do Lab (Admin)</p>
      <p className="text-xs text-muted-foreground mb-3">
        Defina quais controles ficarão disponíveis para o estudante.
      </p>

      <div className="space-y-2">
        {items.map((item) => {
          const mode = controlModes[item.key] ?? "show";
          const isOn = mode === "show";
          return (
            <div key={item.key} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">{item.label}</span>
                <Switch
                  checked={isOn}
                  onCheckedChange={(checked) =>
                    setControlMode(item.key, checked ? "show" : "hidden")
                  }
                />
              </div>
              {!isOn && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "hidden" ? "default" : "outline"}
                    onClick={() => setControlMode(item.key, "hidden")}
                  >
                    Ocultar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "disabled" ? "default" : "outline"}
                    onClick={() => setControlMode(item.key, "disabled")}
                  >
                    Desabilitar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

