import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AXIS_CAL_STEP_GOALS,
  CalibrationSampleWindow,
  GravityFaceTracker,
  formatFlatGravityHint,
  formatGravityTiltHint,
  isCalibrationCoverageComplete,
  type AxisCalStep,
} from "@/features/ar-slice/axisCalibration";
import { getAxisCalRefs, poseBuffer, useArSliceStore } from "@/features/ar-slice/arSliceStore";

const CAL_INTRO =
  "Primeiro removemos o bias do giroscópio em repouso; depois calibramos a gravidade e o alinhamento físico da moldura.";

type StepUi = {
  title: string;
  bullets: string[];
  confirmLabel: string;
};

const STEPS: Record<1 | 2, StepUi> = {
  1: {
    title: "Passo 1 — Moldura deitada na mesa",
    bullets: [
      "Apoie a moldura em uma mesa plana.",
      "O anel/janela deve olhar para CIMA (como um quadro deitado).",
      "Não segure na mão — também medimos o zero da aceleração linear.",
    ],
    confirmLabel: "Confirmar — moldura plana",
  },
  2: {
    title: "Passo 2 — Borda direita para cima (90°)",
    bullets: [
      "Mantenha a borda ESQUERDA apoiada na mesa.",
      "Levante só a borda DIREITA até a moldura ficar em pé (formato L).",
      "O anel continua olhando para você — como uma porta aberta.",
    ],
    confirmLabel: "Confirmar — moldura em L",
  },
};

function StepDots({ step }: { step: AxisCalStep }) {
  const labels = ["Repouso", "Em L", "Lados"] as const;
  return (
    <div className="flex items-center justify-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = step > n || step === 4;
        const active = step === n;
        return (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-cyan-500 text-slate-950"
                  : done
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-400"
              }`}
            >
              {done && !active ? "✓" : n}
            </div>
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FrameDiagram({ step }: { step: 1 | 2 }) {
  if (step === 1) {
    return (
      <svg viewBox="0 0 240 160" className="mx-auto h-40 w-full" aria-hidden>
        <rect x="8" y="118" width="224" height="10" rx="2" fill="#475569" />
        <text x="120" y="152" textAnchor="middle" fill="#64748b" fontSize="11">
          mesa
        </text>
        <rect x="45" y="68" width="150" height="50" rx="5" fill="#164e63" stroke="#22d3ee" strokeWidth="2" />
        <ellipse cx="120" cy="93" rx="22" ry="16" fill="none" stroke="#67e8f9" strokeWidth="2" strokeDasharray="5 3" />
        <text x="120" y="58" textAnchor="middle" fill="#22d3ee" fontSize="12" fontWeight="bold">
          ANEL ↑ (para o teto)
        </text>
        <text x="32" y="93" fill="#fbbf24" fontSize="10">
          esq.
        </text>
        <text x="198" y="93" fill="#fbbf24" fontSize="10">
          dir.
        </text>
        <path d="M120 68 V48" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#up)" />
        <defs>
          <marker id="up" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,6 L3,0 L6,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 240 160" className="mx-auto h-40 w-full" aria-hidden>
      <rect x="8" y="118" width="224" height="10" rx="2" fill="#475569" />
      <text x="48" y="132" fill="#64748b" fontSize="10">
        borda esq. na mesa
      </text>
      <rect x="32" y="88" width="100" height="30" rx="4" fill="#164e63" stroke="#22d3ee" strokeWidth="2" />
      <rect x="132" y="32" width="30" height="86" rx="4" fill="#0e7490" stroke="#22d3ee" strokeWidth="2" />
      <ellipse cx="147" cy="62" rx="10" ry="14" fill="none" stroke="#67e8f9" strokeWidth="2" />
      <text x="175" y="55" fill="#fbbf24" fontSize="11" fontWeight="bold">
        90°
      </text>
      <path d="M158 48 L178 28" stroke="#fbbf24" strokeWidth="2" />
      <text x="175" y="95" fill="#22d3ee" fontSize="11">
        borda dir.
      </text>
      <text x="175" y="108" fill="#22d3ee" fontSize="11">
        para CIMA
      </text>
    </svg>
  );
}

function SensorBanner({ hasGravity }: { hasGravity: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs leading-snug ${
        hasGravity
          ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
          : "border-amber-500/40 bg-amber-950/30 text-amber-100"
      }`}
    >
      {hasGravity ? (
        <>
          <strong>Acelerômetro ativo</strong> — stream envia gravidade (gx/gy/gz). A calibração usa o
          vetor de gravidade do BNO085.
        </>
      ) : (
        <>
          <strong>Acelerômetro indisponível</strong> — o stream não traz gx/gy/gz. Reflash do firmware
          da moldura para calibrar pela gravidade (fallback: orientação apenas).
        </>
      )}
    </div>
  );
}

type Props = {
  onCalibrationCommand: (command: "CAL_START" | "CAL_CANCEL" | "CAL_SAVE") => void;
};

export function AxisCalibrationDialog({ onCalibrationCommand }: Props) {
  const axisCalStep = useArSliceStore((s) => s.axisCalStep);
  const axisCalError = useArSliceStore((s) => s.axisCalError);
  const axisCalResult = useArSliceStore((s) => s.axisCalResult);
  const axisCalFaces = useArSliceStore((s) => s.axisCalFaces);
  const imuHealth = useArSliceStore((s) => s.imuHealth);
  const captureAxisCalibrationPose = useArSliceStore((s) => s.captureAxisCalibrationPose);
  const setAxisCalibrationFaces = useArSliceStore((s) => s.setAxisCalibrationFaces);
  const finishAxisCalibration = useArSliceStore((s) => s.finishAxisCalibration);
  const cancelAxisCalibration = useArSliceStore((s) => s.cancelAxisCalibration);
  const dismissAxisCalibration = useArSliceStore((s) => s.dismissAxisCalibration);

  const [liveHint, setLiveHint] = useState<string | null>(null);
  const sampleWindow = useRef(new CalibrationSampleWindow());
  const faceTracker = useRef(new GravityFaceTracker());
  const captureLock = useRef(false);
  const commandStarted = useRef(false);
  const open = axisCalStep >= 1 && axisCalStep <= 4;

  useEffect(() => {
    if (!open) {
      commandStarted.current = false;
      return;
    }
    if (!commandStarted.current) {
      commandStarted.current = true;
      onCalibrationCommand("CAL_START");
    }
  }, [onCalibrationCommand, open]);

  useEffect(() => {
    sampleWindow.current.reset();
    captureLock.current = false;
    if (axisCalStep === 1) faceTracker.current.reset();
  }, [axisCalStep]);

  useEffect(() => {
    if (!open || axisCalStep === 4) return;
    const id = window.setInterval(() => {
      const { gravityFlat } = getAxisCalRefs();
      const g = poseBuffer.gravityImu;
      if (!g) {
        setLiveHint(null);
        return;
      }
      sampleWindow.current.push(poseBuffer.imu, g);
      const pose = sampleWindow.current.pose(axisCalStep === 1 ? 2200 : 850);

      if (axisCalStep === 1) {
        const hint = formatFlatGravityHint(g);
        setLiveHint(
          hint ??
            (pose
              ? "Estável. Giroscópio e referência plana capturados automaticamente."
              : "Não mova a moldura — medindo o bias do giroscópio…"),
        );
        if (pose && !hint && !captureLock.current) {
          captureLock.current = true;
          captureAxisCalibrationPose(pose);
        }
      } else if (axisCalStep === 2 && gravityFlat) {
        setLiveHint(formatGravityTiltHint(gravityFlat, g));
        if (
          pose &&
          Math.abs(
            90 -
              Math.acos(
                Math.max(
                  -1,
                  Math.min(
                    1,
                    (gravityFlat.x * pose.gravity.x +
                      gravityFlat.y * pose.gravity.y +
                      gravityFlat.z * pose.gravity.z) /
                      (Math.hypot(gravityFlat.x, gravityFlat.y, gravityFlat.z) || 1),
                  ),
                ),
              ) *
                (180 / Math.PI),
          ) <= 18 &&
          !captureLock.current
        ) {
          captureLock.current = true;
          faceTracker.current.add(gravityFlat);
          setAxisCalibrationFaces(faceTracker.current.add(pose.gravity));
          captureAxisCalibrationPose(pose);
        }
      } else if (axisCalStep === 3) {
        setLiveHint(
          pose
            ? "Posição estável reconhecida. Gire para outro lado."
            : "Gire suavemente e pare por um segundo em cada lado.",
        );
        if (pose) {
          const count = faceTracker.current.add(pose.gravity);
          if (count !== axisCalFaces) setAxisCalibrationFaces(count);
          const calibration = poseBuffer.calibration;
          if (
            isCalibrationCoverageComplete(count, calibration) &&
            !captureLock.current
          ) {
            captureLock.current = true;
            onCalibrationCommand("CAL_SAVE");
            window.setTimeout(finishAxisCalibration, 300);
          }
        }
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [
    axisCalFaces,
    axisCalStep,
    captureAxisCalibrationPose,
    finishAxisCalibration,
    onCalibrationCommand,
    open,
    setAxisCalibrationFaces,
  ]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onCalibrationCommand("CAL_CANCEL");
      cancelAxisCalibration();
    }
  };

  if (!open) return null;

  if (axisCalStep === 4) {
    return (
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md border-emerald-500/40 bg-slate-950 text-slate-100 sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-emerald-300">Calibração concluída</DialogTitle>
            <DialogDescription className="text-slate-300">{axisCalResult}</DialogDescription>
          </DialogHeader>
          <StepDots step={4} />
          <p className="text-center text-sm text-slate-400">
            Incline a moldura para cima/baixo — o corte anatômico segue a gravidade (acelerômetro).
          </p>
          <DialogFooter>
            <Button className="w-full" onClick={dismissAxisCalibration}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (axisCalStep === 3) {
    return (
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md border-cyan-500/30 bg-slate-950 text-slate-100 sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Calibrar escala do acelerômetro</DialogTitle>
            <DialogDescription className="text-slate-300">
              Mostre lados diferentes da moldura. Cada posição estável é reconhecida automaticamente.
            </DialogDescription>
          </DialogHeader>
          <StepDots step={3} />
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center">
            <p className="text-4xl font-bold text-cyan-300">{Math.min(axisCalFaces, 4)}/4</p>
            <p className="mt-2 text-sm text-slate-300">posições distintas capturadas</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all"
                style={{ width: `${Math.min(100, axisCalFaces * 25)}%` }}
              />
            </div>
          </div>
          <p className="rounded-md bg-slate-900 px-3 py-2 text-center text-xs text-cyan-200">
            {liveHint}
          </p>
          <p className="text-center text-xs text-slate-400">
            Qualidade do chip: {imuHealth === "excellent" ? "excelente" : imuHealth === "good" ? "boa" : "calibrando"}
          </p>
          <DialogFooter>
            <Button variant="outline" className="w-full border-white/20" onClick={() => handleOpenChange(false)}>
              Cancelar calibração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const step = axisCalStep as 1 | 2;
  const content = STEPS[step];

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-cyan-500/30 bg-slate-950 text-slate-100 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Calibrar acelerômetro (gravidade)</DialogTitle>
          <DialogDescription className="text-left text-xs leading-relaxed text-slate-400">
            {CAL_INTRO}
          </DialogDescription>
        </DialogHeader>

        <SensorBanner hasGravity={poseBuffer.hasSensorGravity} />
        <StepDots step={step} />

        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <p className="mb-1 text-sm font-semibold text-cyan-200">{content.title}</p>
          <p className="mb-3 text-xs text-emerald-200/90">{AXIS_CAL_STEP_GOALS[step]}</p>
          <FrameDiagram step={step} />
          <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
            {content.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-cyan-400">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {liveHint && (
          <p className="rounded-md bg-slate-900 px-3 py-2 text-center text-xs text-cyan-200">
            {liveHint}
          </p>
        )}

        {axisCalError && (
          <p className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-100">
            {axisCalError}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" size="lg" onClick={captureAxisCalibrationPose}>
            {content.confirmLabel}
          </Button>
          <Button
            variant="outline"
            className="w-full border-white/20"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar calibração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
