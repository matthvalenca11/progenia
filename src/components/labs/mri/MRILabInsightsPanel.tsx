/**
 * MRI Lab Insights Panel
 */

import { useMemo, useState } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { MRIPreset, TISSUE_PROPERTIES } from "@/types/mriLabConfig";
import { Signal, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IdealParams {
  preset: MRIPreset;
  tr: number;
  te: number;
  flipAngle: number;
  sequenceType: string;
}

function getIdealParams(preset: MRIPreset): IdealParams | null {
  switch (preset) {
    case "t1_weighted":
      return {
        preset,
        tr: 500,
        te: 20,
        flipAngle: 90,
        sequenceType: "spin_echo",
      };
    case "t2_weighted":
      return {
        preset,
        tr: 3000,
        te: 100,
        flipAngle: 90,
        sequenceType: "spin_echo",
      };
    case "proton_density":
      return {
        preset,
        tr: 3000,
        te: 20,
        flipAngle: 90,
        sequenceType: "spin_echo",
      };
    default:
      return null;
  }
}

export function MRILabInsightsPanel() {
  const { simulationResult, config, dicomReady, dicomVolumeA, activeSequence } = useMRILabStore();
  const [showComparison, setShowComparison] = useState(false);
  const hasClinicalVolume = dicomReady && !!dicomVolumeA;

  const matrixSize = config.matrixSize ?? 128;
  const nex = config.nex ?? 1;

  const examTimeMs = config.tr * matrixSize * nex;
  const examTimeSeconds = Math.max(0, Math.round(examTimeMs / 1000));
  const minutes = Math.floor(examTimeSeconds / 60);
  const seconds = examTimeSeconds % 60;
  const formattedExamTime =
    minutes > 0 ? `${minutes}min ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;

  const safeMatrix = matrixSize || 128;
  const safeNex = Math.max(nex, 1);
  const snrRelative = Math.sqrt(safeNex) / (safeMatrix / 128);

  const idealParams = useMemo(() => getIdealParams(config.preset), [config.preset]);

  const parameterEffects = useMemo(() => {
    const effects: string[] = [];

    // TR
    if (config.tr <= 800) {
      effects.push("TR curto → mais T1, exame rápido, menor SNR.");
    } else if (config.tr >= 2000) {
      effects.push("TR longo → menos T1, mais T2/PD, exame mais lento.");
    }

    // TE
    if (config.te <= 30) {
      effects.push("TE curto → pouco T2, menos realce de edema/LCR.");
    } else if (config.te >= 80) {
      effects.push("TE longo → mais T2, líquidos/edema mais brilhantes.");
    }

    // TI (para IR/FLAIR)
    if (config.sequenceType === "inversion_recovery" && config.ti != null) {
      const t1Csf = TISSUE_PROPERTIES.csf.t1;
      const targetTi = t1Csf * Math.log(2);
      const rel = Math.abs(config.ti - targetTi) / targetTi;

      if (rel < 0.15) {
        effects.push("TI ideal em FLAIR → LCR quase nulo, edema segue brilhante.");
      } else if (config.ti < targetTi) {
        effects.push("TI curto em FLAIR → LCR reaparece, supressão parcial.");
      } else {
        effects.push("TI longo em FLAIR → LCR volta a ter sinal.");
      }
    }

    // Flip Angle
    if (config.flipAngle <= 30) {
      effects.push("Flip baixo → típico de GRE, mais T2* e menos T1.");
    } else if (config.flipAngle >= 80) {
      effects.push("Flip ~90° → típico de SE, contraste guiado por TR/TE.");
    }

    // Sequência clínica ativa (quando houver)
    if (activeSequence) {
      if (activeSequence === "t1") {
        effects.push("Sequência T1 → gordura/WM mais claras, LCR escuro.");
      } else if (activeSequence === "t2") {
        effects.push("Sequência T2 → líquido/edema bem hiperintensos.");
      } else if (activeSequence === "flair") {
        effects.push("Sequência FLAIR → LCR suprimido, edema periventricular brilhante.");
      } else if (activeSequence === "t1ce") {
        effects.push("Sequência T1ce → realce de tumor/inflamação pós-contraste.");
      }
    }

    return effects;
  }, [config.tr, config.te, config.ti, config.flipAngle, config.sequenceType, activeSequence]);

  const protocolInsights = useMemo(() => {
    const positives: string[] = [];
    const warnings: string[] = [];

    // Insight FLAIR: TI ~ T1_CSF * ln(2)
    if (config.sequenceType === "inversion_recovery" && config.ti != null) {
      const t1Csf = TISSUE_PROPERTIES.csf.t1;
      const targetTi = t1Csf * Math.log(2);
      const tolerance = t1Csf * 0.15;
      if (Math.abs(config.ti - targetTi) <= tolerance) {
        positives.push(
          "Ótimo! Você configurou um FLAIR (anulação de líquor) próximo do TI ideal para CSF."
        );
      }
    }

    // Alerta: preset T2, mas TR/TE muito curtos
    if (config.preset === "t2_weighted") {
      if (config.tr < 1500 || config.te < 60) {
        warnings.push(
          "Atenção: Para uma ponderação T2 clássica, use TR mais longo e TE mais alto; seus parâmetros atuais estão mais próximos de T1/PD."
        );
      }
    }

    return { positives, warnings };
  }, [config.sequenceType, config.ti, config.preset, config.tr, config.te]);

  // Sem dados: nem simulação nem volume clínico
  if (!simulationResult && !hasClinicalVolume) {
    return (
      <div className="h-full bg-card flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground text-xs text-center">
          Métricas de simulação aparecem aqui quando um phantom estiver ativo. Com caso clínico (T1/T2), os parâmetros TR/TE ao lado controlam o blend na Fatia 2D.
        </p>
      </div>
    );
  }

  // Volume clínico (T1/T2) sem simulação: painel resumido com TR/TE e blend
  if (hasClinicalVolume && !simulationResult) {
    const getBlendFactor = useMRILabStore.getState().getBlendFactor;
    const blend = getBlendFactor();
    return (
      <div className="h-full flex flex-col bg-card">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-medium text-foreground">Métricas</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="p-2.5 bg-muted/50 rounded-lg space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Parâmetros ativos</span>
            </div>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div>TR: {config.tr} ms</div>
              <div>TE: {config.te} ms</div>
              <div>Flip Angle: {config.flipAngle}°</div>
              <div className="pt-1 text-foreground">
                Blend T1↔T2: {Math.round(blend * 100)}% (TR e TE: mais altos → mais T2)
              </div>
            </div>
          </div>

          {parameterEffects.length > 0 && (
            <div className="p-2.5 bg-cyan-500/5 rounded-lg border border-cyan-500/20 space-y-1">
              {parameterEffects.map((text, idx) => (
                <p key={idx} className="text-[10px] text-muted-foreground">
                  {text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Métricas</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Signal Intensity */}
        <div className="p-2.5 bg-cyan-500/10 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Signal className="h-3 w-3 text-cyan-400" />
              <span className="text-[11px] text-muted-foreground">Sinal Médio</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {simulationResult.averageSignal.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Min: {simulationResult.minSignal.toFixed(3)}</span>
            <span>Max: {simulationResult.maxSignal.toFixed(3)}</span>
          </div>
        </div>

        {/* Tissue Signals */}
        <div className="p-2.5 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-purple-400" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Sinal por Tecido
            </span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(simulationResult.tissueSignals).map(([tissue, signal]) => {
              const tissueProps = TISSUE_PROPERTIES[tissue];
              return (
                <div key={tissue} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: tissueProps?.color || "#ffffff" }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {tissueProps?.name || tissue}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-foreground">{signal.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acquisition Info */}
        <div className="p-2.5 bg-muted/50 rounded-lg space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="h-3 w-3 text-blue-400" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Parâmetros Ativos
            </span>
          </div>
          <div className="space-y-1 text-[10px] text-muted-foreground">
            <div>TR: {config.tr} ms</div>
            <div>TE: {config.te} ms</div>
            {config.sequenceType === "inversion_recovery" && config.ti != null && (
              <div>TI: {config.ti} ms</div>
            )}
            <div>Flip Angle: {config.flipAngle}°</div>
            <div>Sequência: {config.sequenceType.replace("_", " ")}</div>
          </div>
        </div>

        {/* Acquisition Statistics */}
        <div className="p-2.5 bg-muted/60 rounded-lg space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Estatísticas de Aquisição
            </span>
          </div>
          <div className="space-y-1 text-[10px] text-muted-foreground">
            <div>
              Matrix: <span className="font-mono text-foreground">{matrixSize}</span>
              {"  •  "}
              NEX: <span className="font-mono text-foreground">{safeNex}</span>
            </div>
            <div>
              Tempo de exame estimado:{" "}
              <span className="font-mono text-foreground">{formattedExamTime}</span>
            </div>
            <div>
              SNR relativo (vs 128 / NEX 1):{" "}
              <span className="font-mono text-foreground">
                {snrRelative.toFixed(2)}×
              </span>
            </div>
            {idealParams && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setShowComparison((prev) => !prev)}
                >
                  Comparar com Ideal
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Protocol insights */}
        {protocolInsights.positives.length > 0 && (
          <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/25 space-y-1">
            {protocolInsights.positives.map((msg, idx) => (
              <p key={idx} className="text-[10px] text-emerald-400">
                {msg}
              </p>
            ))}
          </div>
        )}

        {protocolInsights.warnings.length > 0 && (
          <div className="p-2.5 bg-red-500/10 rounded-lg border border-red-500/30 space-y-1">
            {protocolInsights.warnings.map((msg, idx) => (
              <p key={idx} className="text-[10px] text-red-400">
                {msg}
              </p>
            ))}
          </div>
        )}

        {/* Comparison table */}
        {idealParams && showComparison && (
          <div className="p-2.5 bg-muted/70 rounded-lg border border-border/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Comparação com protocolo ideal ({idealParams.preset})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-5 px-1 text-[10px]"
                onClick={() => setShowComparison(false)}
              >
                Fechar
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <div className="font-semibold">Parâmetro</div>
              <div className="font-semibold">Atual</div>
              <div className="font-semibold">Ideal</div>

              <div>TR (ms)</div>
              <div className="font-mono text-foreground">{config.tr}</div>
              <div className="font-mono text-foreground">{idealParams.tr}</div>

              <div>TE (ms)</div>
              <div className="font-mono text-foreground">{config.te}</div>
              <div className="font-mono text-foreground">{idealParams.te}</div>

              <div>Flip (°)</div>
              <div className="font-mono text-foreground">{config.flipAngle}</div>
              <div className="font-mono text-foreground">{idealParams.flipAngle}</div>

              <div>Sequência</div>
              <div className="font-mono text-foreground">
                {config.sequenceType.replace("_", " ")}
              </div>
              <div className="font-mono text-foreground">
                {idealParams.sequenceType.replace("_", " ")}
              </div>
            </div>
          </div>
        )}

        {/* Artifact explanations */}
        {config.simulateArtifacts && (
          <div className="p-2.5 bg-orange-500/10 rounded-lg border border-orange-500/25 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-orange-400" />
              <span className="text-[11px] font-medium text-orange-400">
                Artefatos simulados ativos
              </span>
            </div>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Movimento (ghosting):</span>{" "}
                repetições fantasma ao longo do eixo de fase simulam cortes adquiridos com o
                paciente se movendo entre linhas de k-space.
              </p>
              <p>
                <span className="font-semibold text-foreground">Chemical shift água/gordura:</span>{" "}
                a gordura precessa em frequência ligeiramente diferente da água; isso desloca o
                contorno de gordura alguns pixels no eixo de frequência, gerando bordas
                desalinhas típicas do deslocamento químico.
              </p>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {simulationResult.recommendations.length > 0 && (
          <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] font-medium text-blue-400">Recomendações</span>
            </div>
            <div className="space-y-1">
              {simulationResult.recommendations.map((rec, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  • {rec}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {simulationResult.riskFactors.length > 0 && (
          <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-medium text-amber-400">Atenção</span>
            </div>
            <div className="space-y-1">
              {simulationResult.riskFactors.map((factor, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  • {factor}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
