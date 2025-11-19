import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FrequencyMHz = 1 | 3;
type Mode = "continuous" | "pulsed";

export function TherapeuticUltrasoundLab() {
  const [frequencyMHz, setFrequencyMHz] = useState<FrequencyMHz>(1);
  const [intensity, setIntensity] = useState(1.0); // W/cm²
  const [era, setEra] = useState(5);               // cm²
  const [mode, setMode] = useState<Mode>("continuous");
  const [dutyCycle, setDutyCycle] = useState(50);  // %
  const [durationMin, setDurationMin] = useState(8); // min

  const results = useMemo(() => {
    const duty = mode === "continuous" ? 1 : dutyCycle / 100;
    const timeSec = durationMin * 60;

    const powerW = intensity * era;
    const energyJ = powerW * timeSec * duty;
    const doseJcm2 = intensity * timeSec * duty;

    let doseLabel = "Dose baixa (< 5 J/cm²)";
    if (doseJcm2 >= 5 && doseJcm2 <= 20) doseLabel = "Dose moderada (5–20 J/cm²)";
    if (doseJcm2 > 20) doseLabel = "Dose alta (> 20 J/cm²)";

    return {
      powerW,
      energyJ,
      doseJcm2,
      doseLabel,
    };
  }, [intensity, era, mode, dutyCycle, durationMin]);

  // Fatores para mapeamento visual
  const intensityFactor = Math.min(Math.max(intensity / 2.5, 0), 1); // 0–1
  const dutyFactor = mode === "continuous" ? 1 : dutyCycle / 100;
  const totalFactor = Math.min(results.doseJcm2 / 25, 1); // normaliza para visual (0–~1)

  // Duração da animação das ondas (3 MHz = mais rápido)
  const waveDuration = frequencyMHz === 1 ? 2.8 : 1.6;

  const depths = [1, 2, 3, 4, 5];
  const mu = frequencyMHz === 1 ? 0.35 : 1.0; // coeficiente de atenuação simplificado

  const depthIntensities = depths.map((z) => {
    const rel = Math.exp(-mu * z); // I(z)/I0
    return rel;
  });

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">
          Laboratório Virtual – Ultrassom Terapêutico
        </h2>
        <p className="text-sm text-muted-foreground">
          Ajuste os parâmetros da aplicação de ultrassom e observe o impacto na potência, dose
          (energia por área) e na profundidade de penetração do feixe.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* CONTROLES E RESULTADOS */}
        <div className="space-y-6">
          {/* Frequência */}
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select
              value={String(frequencyMHz)}
              onValueChange={(v) => setFrequencyMHz(Number(v) as FrequencyMHz)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 MHz (mais profundo)</SelectItem>
                <SelectItem value="3">3 MHz (mais superficial)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              1 MHz tende a alcançar estruturas mais profundas; 3 MHz atua mais superficialmente.
            </p>
          </div>

          {/* Intensidade */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Intensidade (W/cm²)</Label>
              <span className="text-sm font-medium">
                {intensity.toFixed(2)} W/cm²
              </span>
            </div>
            <Slider
              min={0.1}
              max={2.5}
              step={0.1}
              value={[intensity]}
              onValueChange={([v]) => setIntensity(v)}
            />
          </div>

          {/* ERA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>ERA – Área efetiva (cm²)</Label>
              <Input
                type="number"
                min={3}
                max={10}
                value={era}
                onChange={(e) => setEra(Number(e.target.value) || 0)}
                className="w-24 h-8 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A potência total depende da intensidade e da área efetiva do cabeçote.
            </p>
          </div>

          {/* Modo + Duty */}
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continuous">Contínuo (100%)</SelectItem>
                <SelectItem value="pulsed">Pulsado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "pulsed" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Duty cycle (%)</Label>
                <span className="text-sm font-medium">{dutyCycle}%</span>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[dutyCycle]}
                onValueChange={([v]) => setDutyCycle(v)}
              />
              <p className="text-xs text-muted-foreground">
                Duty cycle reduz a fração de tempo em que o feixe está efetivamente ligado.
              </p>
            </div>
          )}

          {/* Duração */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Duração da sessão (min)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
                className="w-24 h-8 text-sm"
              />
            </div>
          </div>

          {/* Resultados numéricos */}
          <Card className="p-4 space-y-1 bg-muted/70">
            <p className="text-sm">
              <span className="font-semibold">Potência:</span>{" "}
              {results.powerW.toFixed(2)} W
            </p>
            <p className="text-sm">
              <span className="font-semibold">Energia total:</span>{" "}
              {results.energyJ.toFixed(1)} J
            </p>
            <p className="text-sm">
              <span className="font-semibold">Dose (energia por área):</span>{" "}
              {results.doseJcm2.toFixed(1)} J/cm²
            </p>
            <p className="text-sm">
              <span className="font-semibold">Interpretação:</span>{" "}
              {results.doseLabel}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Valores servem como apoio didático para discutir dose relativa e não
              substituem protocolos clínicos.
            </p>
          </Card>
        </div>

        {/* VISUAL / ANIMAÇÕES */}
        <div className="space-y-4">
          {/* Probe + tecidos + ondas */}
          <Card className="p-4 bg-slate-900 text-slate-50 relative overflow-hidden">
            <p className="text-sm mb-2 font-medium">
              Propagação do feixe e profundidade de penetração
            </p>

            <div className="relative mx-auto mt-2 h-56 w-full max-w-md rounded-3xl bg-slate-800 border border-slate-600 overflow-hidden">
              {/* Probe */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 h-10 rounded-2xl bg-slate-100 shadow-lg flex items-center justify-center text-[11px] text-slate-700 font-medium">
                Probe
              </div>

              {/* Camadas de tecido */}
              <div className="absolute inset-x-0 top-8 bottom-0">
                <div className="h-1/5 bg-amber-200/70 border-b border-amber-300/60 flex items-center px-3 text-[10px] text-slate-900 font-medium">
                  Pele
                </div>
                <div className="h-1/5 bg-yellow-100/70 border-b border-yellow-200/70 flex items-center px-3 text-[10px] text-slate-900 font-medium">
                  Tecido subcutâneo
                </div>
                <div className="h-3/5 bg-emerald-900/70 flex items-center px-3 text-[10px] text-emerald-100 font-medium">
                  Músculo
                </div>
              </div>

              {/* Ondas descendo – 3 "frentes de onda" */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute left-1/2 -translate-x-1/2 w-[75%] h-[140%] border-[2px] rounded-b-full pointer-events-none"
                  style={{
                    borderColor: `rgba(56, 189, 248, ${
                      0.1 + 0.6 * intensityFactor * dutyFactor
                    })`,
                    boxShadow: `0 0 ${10 + 25 * intensityFactor}px rgba(56, 189, 248, 0.7)`,
                    animation: `ultrasoundWave ${waveDuration}s linear infinite`,
                    animationDelay: `${(waveDuration / 3) * i}s`,
                  }}
                />
              ))}

              {/* "Zona efetiva" de tratamento – brilho proporcional à dose */}
              <div
                className="absolute inset-x-8 top-16 bottom-8 rounded-3xl bg-cyan-400/10 blur-2xl transition-all"
                style={{
                  opacity: 0.15 + totalFactor * 0.7,
                  boxShadow: `0 0 ${15 + 30 * totalFactor}px rgba(34,211,238,0.8)`,
                }}
              />
            </div>

            <p className="mt-3 text-[11px] text-slate-300">
              A velocidade e o "alcance" visual das ondas variam com a frequência (1 MHz → mais
              profundo; 3 MHz → mais superficial). O brilho da região tratada aumenta com a
              combinação de intensidade, duty cycle e tempo de aplicação.
            </p>
          </Card>

          {/* Barras por profundidade */}
          <Card className="p-4">
            <p className="text-sm mb-2 font-medium">
              Intensidade relativa em diferentes profundidades
            </p>
            <div className="flex items-end gap-3 h-32">
              {depths.map((z, idx) => {
                const rel = depthIntensities[idx];
                const height = 20 + rel * 80; // px
                const opacity = 0.25 + rel * 0.7;

                return (
                  <div key={z} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t-md bg-cyan-500 transition-all"
                      style={{
                        height: `${height}px`,
                        opacity,
                      }}
                    />
                    <span className="text-[11px] text-muted-foreground font-medium">{z} cm</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              O modelo de atenuação exponencial mostra como a intensidade relativa do feixe cai com
              a profundidade. Em 3 MHz a queda é mais rápida (camada mais superficial), enquanto em
              1 MHz a energia alcança regiões mais profundas.
            </p>
          </Card>
        </div>
      </div>
    </Card>
  );
}
