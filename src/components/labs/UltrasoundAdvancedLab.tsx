import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type DepthSample = {
  zCm: number;
  relIntensity: number; // 0–1
};

/**
 * Modelo simples de profundidade: atenuação + foco gaussiano.
 * fMHz: frequência em MHz (1–3)
 * focusCm: profundidade de foco (1–5 cm)
 */
function computeUltrasoundDepthProfile(
  fMHz: number,
  focusCm: number,
  maxDepthCm = 6,
  stepCm = 0.5
): DepthSample[] {
  // comprimento de onda em cm (c ≈ 1540 m/s = 154000 cm/s)
  const lambdaCm = 154000 / (fMHz * 1_000_000);
  const apertureCm = 3; // diâmetro do transdutor
  const nearFieldCm = (apertureCm * apertureCm) / (4 * lambdaCm); // campo próximo

  // atenuação ~0.5 dB/cm/MHz
  const alpha_dB_per_cm = 0.5 * fMHz;

  const sigmaCm = nearFieldCm / 3; // largura do foco
  const samples: DepthSample[] = [];

  for (let z = 0; z <= maxDepthCm + 1e-6; z += stepCm) {
    const att_dB = alpha_dB_per_cm * z;
    const attFactor = Math.pow(10, -att_dB / 10); // 10^(−dB/10)

    const focusShape = Math.exp(
      -Math.pow(z - focusCm, 2) / (2 * sigmaCm * sigmaCm)
    );

    const raw = attFactor * focusShape;
    samples.push({ zCm: parseFloat(z.toFixed(2)), relIntensity: raw });
  }

  const maxVal = Math.max(...samples.map((s) => s.relIntensity), 1e-6);
  return samples.map((s) => ({
    ...s,
    relIntensity: s.relIntensity / maxVal,
  }));
}

const UltrasoundAdvancedLab = () => {
  // sliders (mapping igual ao que o Lovable já usa)
  const [gainPercent, setGainPercent] = useState(60);      // 0–100
  const [focusPercent, setFocusPercent] = useState(50);    // 0–100
  const [freqPercent, setFreqPercent] = useState(50);      // 0–100

  // mapeia para grandezas físicas
  const intensity = 0.1 + (gainPercent / 100) * 2.4;       // 0.1–2.5 W/cm²
  const focusDepthCm = 1 + (focusPercent / 100) * 4;       // 1–5 cm
  const frequencyMHz = 1 + (freqPercent / 100) * 2;        // 1–3 MHz
  const eraCm2 = 5;                                        // área efetiva fixa
  const timeSec = 5 * 60;                                  // sessão de referência: 5 min

  const duty = 1; // aqui podemos assumir contínuo; se depois tiver modo pulsado é só plugar

  const powerW = intensity * eraCm2;
  const energyJ = powerW * timeSec * duty;
  const doseJcm2 = intensity * timeSec * duty;

  let doseLabel = "Dose baixa (< 5 J/cm²)";
  if (doseJcm2 >= 5 && doseJcm2 <= 20) doseLabel = "Dose moderada (5–20 J/cm²)";
  if (doseJcm2 > 20) doseLabel = "Dose alta (> 20 J/cm²)";

  // perfil de profundidade para visual 1D e 2D
  const depthProfile = useMemo(
    () => computeUltrasoundDepthProfile(frequencyMHz, focusDepthCm, 6, 0.5),
    [frequencyMHz, focusDepthCm]
  );

  const intensityFactor = Math.min(doseJcm2 / 40, 1); // para brilho global
  const waveDuration = 3 - 1.2 * ((frequencyMHz - 1) / 2); // 1MHz ~3s, 3MHz ~1.8s

  const rows = 6; // grid do músculo
  const cols = 10;
  const maxDepthCm = 6;
  const rowDepthStep = maxDepthCm / rows;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">
          Laboratório Virtual – Simulador de Ultrassom Terapêutico
        </h2>
        <p className="text-sm text-muted-foreground">
          Ajuste ganho, profundidade de foco e frequência e observe a propagação das
          ondas, a distribuição espacial da intensidade no músculo e a dose estimada.
        </p>
      </div>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-8">
        {/* VISUAL + RESULTADOS */}
        <div className="space-y-4">
          {/* TELA PRINCIPAL COM PROBE + TECIDOS + HEATMAP + ONDAS */}
          <Card className="relative h-80 w-full overflow-hidden rounded-3xl bg-slate-900 text-slate-50 border border-slate-700">
            {/* Probe */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-28 h-10 rounded-2xl bg-slate-100 shadow-lg z-20 flex items-center justify-center text-[11px] text-slate-700">
              Probe
            </div>

            {/* Camadas */}
            <div className="absolute inset-x-0 top-6 bottom-0">
              <div className="h-1/5 bg-amber-200/80 border-b border-amber-300/60 flex items-center px-3 text-[11px] text-slate-900">
                Pele
              </div>
              <div className="h-1/5 bg-yellow-100/75 border-b border-yellow-200/70 flex items-center px-3 text-[11px] text-slate-900">
                Tecido subcutâneo
              </div>
              <div className="h-3/5 relative bg-slate-900">
                {/* fundo do músculo */}
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900 via-slate-900 to-slate-950" />
                <div className="absolute left-3 top-2 text-[11px] text-emerald-100 opacity-80">
                  Músculo
                </div>

                {/* Heatmap 2D baseado no depthProfile */}
                <div className="absolute inset-x-4 bottom-4 top-6 grid gap-[2px]"
                  style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: rows }).map((_, rowIdx) => {
                    const depthCenter = (rowIdx + 0.5) * rowDepthStep;
                    const sample =
                      depthProfile.reduce((prev, curr) =>
                        Math.abs(curr.zCm - depthCenter) <
                        Math.abs(prev.zCm - depthCenter)
                          ? curr
                          : prev
                      ) || depthProfile[0];

                    return Array.from({ length: cols }).map((_, colIdx) => {
                      const i = sample.relIntensity * (0.4 + 0.6 * intensityFactor);

                      // mapa de cores azul→ciano→verde→amarelo→vermelho
                      const r = Math.round(40 + 215 * i);
                      const g = Math.round(80 + 150 * i);
                      const b = Math.round(120 + 100 * (1 - i));

                      const borderHighlight =
                        Math.abs(sample.zCm - focusDepthCm) < rowDepthStep / 2;

                      return (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className="rounded-[2px]"
                          style={{
                            backgroundColor: `rgba(${r},${g},${b},${0.18 + 0.6 * i})`,
                            boxShadow: borderHighlight
                              ? "0 0 8px rgba(56,189,248,0.9)"
                              : "none",
                          }}
                        />
                      );
                    });
                  })}
                </div>

                {/* Ondas em arco saindo do probe */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute left-1/2 -translate-x-1/2 w-[140%] h-[220%] rounded-b-full border-[1.8px] pointer-events-none"
                    style={{
                      borderColor: `rgba(56,189,248,${
                        0.20 + 0.45 * (1 - i * 0.25)
                      })`,
                      boxShadow: `0 0 ${10 + 10 * (1 - i * 0.3)}px rgba(56,189,248,0.7)`,
                      animation: `ultraWave ${waveDuration}s linear infinite`,
                      animationDelay: `${(waveDuration / 3) * i}s`,
                      opacity: 0.15 + 0.3 * (1 - i * 0.25),
                    }}
                  />
                ))}

                {/* Região mais focal (glow) */}
                <div
                  className="absolute inset-x-8 rounded-3xl bg-cyan-400/10 blur-2xl pointer-events-none transition-all"
                  style={{
                    top: `${(focusDepthCm / maxDepthCm) * 100 - 15}%`,
                    height: "30%",
                    opacity: 0.25 + 0.6 * intensityFactor,
                    boxShadow: `0 0 ${18 + 25 * intensityFactor}px rgba(34,211,238,0.9)`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* GRÁFICO 1D PROFUNDIDADE x INTENSIDADE */}
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">
              Intensidade relativa ao longo da profundidade
            </p>
            <div className="flex items-end gap-2 h-32">
              {depthProfile.map((p) => {
                const height = 20 + p.relIntensity * 70;
                const isFocus =
                  Math.abs(p.zCm - focusDepthCm) < 0.3; // barra próxima do foco

                return (
                  <div
                    key={p.zCm}
                    className="flex flex-col items-center justify-end gap-1"
                  >
                    <div
                      className="w-3 rounded-t-md transition-all"
                      style={{
                        height: `${height}px`,
                        background: isFocus
                          ? "linear-gradient(to top, rgba(248,113,113,0.9), rgba(252,211,77,0.9))"
                          : "linear-gradient(to top, rgba(56,189,248,0.3), rgba(56,189,248,0.8))",
                        opacity: 0.25 + 0.75 * p.relIntensity,
                        boxShadow: isFocus
                          ? "0 0 10px rgba(248,113,113,0.9)"
                          : "0 0 4px rgba(56,189,248,0.6)",
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {p.zCm.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              A queda da intensidade com a profundidade depende da frequência.
              Frequências mais altas (próximas de 3 MHz) atenuam mais rápido e concentram
              a energia em regiões mais superficiais; frequências mais baixas (próximas
              de 1 MHz) preservam energia em profundidades maiores.
            </p>
          </Card>

          {/* PAINEL NUMÉRICO */}
          <Card className="p-4">
            <p className="text-sm">
              <span className="font-semibold">Potência estimada:</span>{" "}
              {powerW.toFixed(2)} W
            </p>
            <p className="text-sm">
              <span className="font-semibold">
                Energia total (sessão 5 min):
              </span>{" "}
              {energyJ.toFixed(1)} J
            </p>
            <p className="text-sm">
              <span className="font-semibold">
                Dose aproximada:
              </span>{" "}
              {doseJcm2.toFixed(1)} J/cm²
            </p>
            <p className="text-sm">
              <span className="font-semibold">Classificação:</span>{" "}
              {doseLabel}
            </p>
          </Card>
        </div>

        {/* CONTROLES DO TRANSDUTOR */}
        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="text-lg font-semibold">Controles do Transdutor</h3>

            {/* Ganho / Brilho */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div>
                  <Label>Ganho / Brilho</Label>
                  <p className="text-xs text-muted-foreground">
                    Controla a intensidade do sinal (W/cm²)
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {intensity.toFixed(2)} W/cm²
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[gainPercent]}
                onValueChange={([v]) => setGainPercent(v)}
              />
            </div>

            {/* Profundidade / Foco */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div>
                  <Label>Profundidade / Foco</Label>
                  <p className="text-xs text-muted-foreground">
                    Ajusta a profundidade de maior concentração de energia
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {focusDepthCm.toFixed(1)} cm
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[focusPercent]}
                onValueChange={([v]) => setFocusPercent(v)}
              />
            </div>

            {/* Frequência */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div>
                  <Label>Frequência (MHz)</Label>
                  <p className="text-xs text-muted-foreground">
                    Afeta resolução e profundidade de penetração
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {frequencyMHz.toFixed(2)} MHz
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[freqPercent]}
                onValueChange={([v]) => setFreqPercent(v)}
              />
            </div>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            Este simulador é um modelo didático simplificado. Ele não substitui
            protocolos clínicos, mas ajuda a visualizar como frequência, foco e
            intensidade influenciam a distribuição espacial da energia no tecido.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default UltrasoundAdvancedLab;
