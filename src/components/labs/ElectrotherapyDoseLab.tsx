import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const minFreq = 1;
const maxFreq = 150;
const minPulse = 50;
const maxPulse = 1000;
const minCurrent = 1;
const maxCurrent = 120;

export function ElectrotherapyDoseLab() {
  const [frequency, setFrequency] = useState(50);    // Hz
  const [pulseWidth, setPulseWidth] = useState(300); // µs
  const [current, setCurrent] = useState(20);        // mA
  const [duration, setDuration] = useState(10);      // min

  const results = useMemo(() => {
    const I_amp = current / 1000; // mA → A
    const pw_sec = pulseWidth / 1_000_000; // µs → s

    const chargePerPulse_C = I_amp * pw_sec;
    const chargePerPulse_mC = chargePerPulse_C * 1000;

    const pulsesPerSession = frequency * duration * 60;
    const totalCharge_mC = chargePerPulse_mC * pulsesPerSession;

    let doseLabel = "Baixa carga total";
    if (totalCharge_mC > 100) doseLabel = "Carga moderada";
    if (totalCharge_mC > 400) doseLabel = "Alta carga total";

    return {
      chargePerPulse_mC,
      pulsesPerSession,
      totalCharge_mC,
      doseLabel,
    };
  }, [current, pulseWidth, frequency, duration]);

  // Mapeia os parâmetros para atributos visuais
  const intensityFactor = current / maxCurrent; // 0–1
  const pulseWidthFactor = (pulseWidth - minPulse) / (maxPulse - minPulse); // 0–1
  const frequencyFactor = (frequency - minFreq) / (maxFreq - minFreq); // 0–1

  // Duração da animação das "bolinhas" no nervo (freq alta = animação mais rápida)
  const nerveAnimationDuration = 3 - 2.2 * frequencyFactor; // ~0.8–3s

  // Quantidade de barras na "timeline" (não vamos desenhar 500, apenas uma amostra)
  const pulseBars = Array.from({ length: 20 });

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Laboratório Virtual – Eletroterapia</h2>
        <p className="text-sm text-muted-foreground">
          Ajuste os parâmetros e observe como eles afetam a carga elétrica e o padrão de
          estimulação sobre o nervo e o músculo.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* CONTROLES */}
        <div className="space-y-6">
          {/* Frequência */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Frequência (Hz)</Label>
              <span className="text-sm font-medium">{frequency} Hz</span>
            </div>
            <Slider
              min={minFreq}
              max={maxFreq}
              step={1}
              value={[frequency]}
              onValueChange={([v]) => setFrequency(v)}
            />
            <p className="text-xs text-muted-foreground">
              Frequências mais altas geram mais pulsos por segundo e podem produzir sensações mais contínuas.
            </p>
          </div>

          {/* Largura de pulso */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Largura de pulso (µs)</Label>
              <span className="text-sm font-medium">{pulseWidth} µs</span>
            </div>
            <Slider
              min={minPulse}
              max={maxPulse}
              step={10}
              value={[pulseWidth]}
              onValueChange={([v]) => setPulseWidth(v)}
            />
            <p className="text-xs text-muted-foreground">
              Pulsos mais longos recrutam fibras mais profundas, mas podem ser menos confortáveis.
            </p>
          </div>

          {/* Intensidade */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Intensidade (mA)</Label>
              <span className="text-sm font-medium">{current} mA</span>
            </div>
            <Slider
              min={minCurrent}
              max={maxCurrent}
              step={1}
              value={[current]}
              onValueChange={([v]) => setCurrent(v)}
            />
            <p className="text-xs text-muted-foreground">
              Intensidade maior aumenta a carga por pulso e a chance de contração visível.
            </p>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Duração da sessão (min)</Label>
              <Input
                className="w-24 h-8 text-sm"
                type="number"
                min={1}
                max={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* RESULTADOS NUMÉRICOS */}
          <Card className="p-4 space-y-1 bg-muted/70">
            <p className="text-sm">
              <span className="font-semibold">Carga por pulso:</span>{" "}
              {results.chargePerPulse_mC.toFixed(4)} mC
            </p>
            <p className="text-sm">
              <span className="font-semibold">Pulsos por sessão (aprox.):</span>{" "}
              {Math.round(results.pulsesPerSession).toLocaleString("pt-BR")}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Carga total na sessão:</span>{" "}
              {results.totalCharge_mC.toFixed(1)} mC
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {results.doseLabel} (apenas interpretação didática, não substitui protocolos clínicos).
            </p>
          </Card>
        </div>

        {/* VISUAL / ANIMAÇÃO */}
        <div className="space-y-4">
          {/* Corpo + eletrodos + nervo */}
          <Card className="relative p-4 overflow-hidden bg-slate-900 text-slate-50">
            <p className="text-sm mb-2 font-medium">Distribuição da corrente e ativação do nervo</p>

            {/* Segmento corporal */}
            <div className="relative mx-auto mt-2 h-40 w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600">
              {/* Tecido muscular de fundo */}
              <div className="absolute inset-x-4 inset-y-6 rounded-2xl bg-gradient-to-r from-emerald-900/60 to-sky-900/40" />

              {/* Eletrodos */}
              <div className="absolute -top-3 left-10 h-8 w-16 rounded-xl border border-slate-200 bg-slate-100 shadow-lg flex items-center justify-center text-[10px] text-slate-700">
                +
              </div>
              <div className="absolute -top-3 right-10 h-8 w-16 rounded-xl border border-slate-200 bg-slate-100 shadow-lg flex items-center justify-center text-[10px] text-slate-700">
                -
              </div>

              {/* "Campo" entre eletrodos – brilho varia com intensidade */}
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 h-24 w-40 rounded-full bg-emerald-400/20 blur-2xl transition-all"
                style={{
                  opacity: 0.3 + intensityFactor * 0.7,
                  boxShadow: `0 0 ${10 + intensityFactor * 25}px rgba(45, 212, 191, 0.9)`,
                }}
              />

              {/* Nervo – linha horizontal */}
              <div className="absolute left-6 right-6 top-1/2 h-1 rounded-full bg-amber-200/80 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />

              {/* Bolinhas se movendo ao longo do nervo (potencial de ação) */}
              <div
                className="absolute left-6 right-6 top-1/2 h-1 overflow-hidden"
                style={{ transform: "translateY(-50%)" }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]"
                    style={{
                      animation: `nervePulse ${nerveAnimationDuration}s linear infinite`,
                      animationDelay: `${i * (nerveAnimationDuration / 3)}s`,
                    }}
                  />
                ))}
              </div>

              {/* Fibras musculares estilizadas */}
              <div className="absolute inset-x-8 bottom-5 h-10 flex gap-1 opacity-70">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-full bg-emerald-500/40"
                    style={{
                      transform: `scaleY(${0.7 + intensityFactor * 0.6})`,
                      transition: "transform 0.3s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-300">
              A cor e o brilho entre os eletrodos aumentam com a intensidade (mA). As bolinhas que
              percorrem o "nervo" ficam mais rápidas conforme a frequência (Hz) aumenta, ilustrando
              mais pulsos por segundo. As barras do músculo sugerem maior recrutamento com maior
              intensidade.
            </p>
          </Card>

          {/* Timeline de pulsos */}
          <Card className="p-4">
            <p className="text-sm mb-2 font-medium">Padrão de pulsos no tempo</p>
            <div className="relative h-20 overflow-hidden bg-slate-100 rounded-lg border">
              <div className="absolute inset-x-2 bottom-2 h-[2px] bg-slate-300" />
              <div className="absolute inset-x-2 top-2 flex items-end gap-[2px]">
                {pulseBars.map((_, idx) => {
                  // posição relativa de 0 a 1
                  const t = idx / pulseBars.length;
                  // imita espaçamento diferente conforme frequência
                  const opacity = 0.2 + 0.8 * frequencyFactor;
                  const heightFactor = 0.2 + intensityFactor * 0.8;
                  const widthPx = 2 + pulseWidthFactor * 8;

                  return (
                    <div
                      key={idx}
                      style={{
                        height: `${20 + 40 * heightFactor}px`,
                        width: `${widthPx}px`,
                        marginRight: `${2 + (1 - frequencyFactor) * 4}px`,
                        opacity,
                      }}
                      className="bg-emerald-500 rounded-t-full transition-all"
                    />
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Barras mais altas representam maior intensidade (mA); barras mais largas, maior
              largura de pulso (µs); maior frequência aproxima as barras, indicando mais pulsos em
              menos tempo.
            </p>
          </Card>
        </div>
      </div>
    </Card>
  );
}
