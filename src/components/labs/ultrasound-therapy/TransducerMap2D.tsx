/**
 * Posicionamento do transdutor — arrastar no mapa + sliders + atalhos
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Move, Target } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { resolveTransducerFace } from "@/config/therapeuticTransducerDefinitions";
import { cn } from "@/lib/utils";
import { utCard, utHint, utLabel } from "./ultrasoundTherapyUi";

interface TransducerMap2DProps {
  className?: string;
  compact?: boolean;
}

const PRESETS = [
  { id: "center", label: "Centro", x: 0, y: 0 },
  { id: "left", label: "Esquerda", x: -0.55, y: 0 },
  { id: "right", label: "Direita", x: 0.55, y: 0 },
  { id: "front", label: "Frente", x: 0, y: 0.55 },
  { id: "back", label: "Trás", x: 0, y: -0.55 },
] as const;

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

export function TransducerMap2D({ className, compact = false }: TransducerMap2DProps) {
  const { config, updateConfig } = useUltrasoundTherapyStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pos = config.transducerPosition ?? { x: 0, y: 0 };
  const face = useMemo(
    () => resolveTransducerFace(config.transducerType ?? "planar_circular", config.era),
    [config.transducerType, config.era],
  );
  const pxPerUnit = 7;
  const isRect = face.kind === "rounded_rect";
  const indicatorW = isRect
    ? Math.min(36, (face.activeHalfW ?? 1) * 2 * pxPerUnit)
    : Math.min(18, (face.activeR ?? face.eqR) * pxPerUnit) * 2;
  const indicatorH = isRect
    ? Math.min(28, (face.activeHalfD ?? 1) * 2 * pxPerUnit)
    : indicatorW;

  const xPercent = ((pos.x + 1) / 2) * 100;
  const yPercent = ((pos.y + 1) / 2) * 100;

  const setPosition = useCallback(
    (x: number, y: number) => {
      updateConfig({ transducerPosition: { x: clamp(x), y: clamp(y) } });
    },
    [updateConfig],
  );

  const updateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = mapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((clientY - rect.top) / rect.height) * 2 - 1;
      setPosition(x, y);
    },
    [setPosition],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromClient(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateFromClient]);

  const [scanProgress, setScanProgress] = useState(0);

  const scanningTrajectory = useMemo(() => {
    if (config.movement !== "scanning") return null;
    const centerX = pos.x;
    const centerY = pos.y;
    const steps = 20;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: clamp(centerX + (-0.22 + t * 0.44)),
        y: clamp(centerY + Math.sin(t * Math.PI * 4) * 0.16),
      });
    }
    return points;
  }, [config.movement, pos.x, pos.y]);

  useEffect(() => {
    if (config.movement !== "scanning" || !scanningTrajectory) {
      setScanProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setScanProgress((prev) => (prev + 1) % scanningTrajectory.length);
    }, 100);
    return () => clearInterval(interval);
  }, [config.movement, scanningTrajectory]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Move className="h-4 w-4 text-muted-foreground" />
        <span className={utLabel}>Posição na pele</span>
      </div>

      {/* Mapa arrastável */}
      <div
        ref={mapRef}
        className={cn(
          utCard,
          "relative w-full cursor-grab overflow-hidden active:cursor-grabbing",
          compact ? "h-40" : "h-52",
        )}
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          updateFromClient(e.clientX, e.clientY);
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-amber-100/40 to-amber-200/20 dark:from-amber-900/20 dark:to-amber-950/10" />

        <div className="absolute inset-0 opacity-25">
          <svg className="h-full w-full">
            {Array.from({ length: 5 }).map((_, i) => (
              <g key={i}>
                <line
                  x1={`${(i + 1) * 20}%`}
                  y1="0"
                  x2={`${(i + 1) * 20}%`}
                  y2="100%"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-border"
                />
                <line
                  x1="0"
                  y1={`${(i + 1) * 20}%`}
                  x2="100%"
                  y2={`${(i + 1) * 20}%`}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-border"
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="pointer-events-none absolute inset-3 rounded-lg border border-dashed border-amber-700/25" />

        {scanningTrajectory && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <path
              d={`M ${scanningTrajectory
                .map((p, i) => {
                  const x = ((p.x + 1) / 2) * 100;
                  const y = ((p.y + 1) / 2) * 100;
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.55"
            />
          </svg>
        )}

        {/* Pegador arrastável — tamanho ~ ERA */}
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
        >
          <div
            className={cn(
              "border-2 border-sky-500 bg-sky-500/25 shadow-md ring-2 ring-white/80 dark:ring-slate-900/80",
              isRect ? "rounded-md" : "rounded-full",
            )}
            style={{ width: indicatorW, height: indicatorH }}
          />
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500" />
        </div>

        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Lateral ← →
        </div>
        <div className="pointer-events-none absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ↑ Frente
        </div>
      </div>

      <p className={cn("text-center", utHint)}>
        Arraste no mapa ou na pele 3D · solte para posicionar
      </p>

      {/* Sliders */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className={utLabel}>Lateral</Label>
            <span className="font-mono text-xs text-muted-foreground">{pos.x.toFixed(2)}</span>
          </div>
          <Slider
            value={[pos.x]}
            onValueChange={([v]) => setPosition(v, pos.y)}
            min={-1}
            max={1}
            step={0.02}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className={utLabel}>Frente / trás</Label>
            <span className="font-mono text-xs text-muted-foreground">{pos.y.toFixed(2)}</span>
          </div>
          <Slider
            value={[pos.y]}
            onValueChange={([v]) => setPosition(pos.x, v)}
            min={-1}
            max={1}
            step={0.02}
          />
        </div>
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(({ id, label, x, y }) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setPosition(x, y)}
          >
            <Target className="mr-1 h-3 w-3 opacity-60" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
