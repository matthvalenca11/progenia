/**
 * DominantEffect - Mostra o efeito dominante na simulação
 */

import { useMemo } from 'react';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';
import { Thermometer, AlertTriangle, Waves, Zap } from 'lucide-react';

interface DominantEffectInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgClass: string;
}

export function DominantEffect({ compact = false }: { compact?: boolean }) {
  const { config, simulationResult } = useUltrasoundTherapyStore();

  const dominantEffect = useMemo((): DominantEffectInfo | null => {
    if (!simulationResult) return null;

    const { surfaceTemp, targetTemp, periostealRisk, thermalDose } = simulationResult;
    const { frequency, era, intensity, mode, movement } = config;

    if (periostealRisk > 0.6) {
      return {
        id: 'periosteal-risk',
        name: 'Risco Periosteal',
        description: `Risco alto próximo ao osso (${(periostealRisk * 100).toFixed(0)}%). Frequência ${frequency} MHz + intensidade ${intensity} W/cm² podem concentrar energia no osso.`,
        icon: AlertTriangle,
        color: 'text-red-500',
        bgClass: 'bg-red-500/10 border-red-500/20',
      };
    }

    if (frequency >= 2.5 && era <= 4 && movement === 'stationary' && surfaceTemp > targetTemp + 1) {
      return {
        id: 'superficial-heating',
        name: 'Aquecimento Superficial',
        description: `Frequência alta (${frequency} MHz) + ERA pequena (${era} cm²) + parado concentram energia na superfície. Temperatura superficial: ${surfaceTemp.toFixed(1)}°C.`,
        icon: Thermometer,
        color: 'text-orange-500',
        bgClass: 'bg-orange-500/10 border-orange-500/20',
      };
    }

    if (frequency <= 1.5 && era >= 6 && mode === 'continuous' && targetTemp > surfaceTemp + 1) {
      return {
        id: 'deep-heating',
        name: 'Aquecimento Profundo',
        description: `Frequência baixa (${frequency} MHz) + ERA grande (${era} cm²) + contínuo permitem penetração profunda. Temperatura no alvo: ${targetTemp.toFixed(1)}°C.`,
        icon: Thermometer,
        color: 'text-blue-500',
        bgClass: 'bg-blue-500/10 border-blue-500/20',
      };
    }

    if (mode === 'pulsed' && intensity >= 2.0 && frequency >= 2.5) {
      return {
        id: 'cavitation',
        name: 'Efeito Mecânico / Cavitação',
        description: `Modo pulsado + intensidade alta (${intensity} W/cm²) + frequência alta (${frequency} MHz) podem causar cavitação. Efeito mecânico dominante.`,
        icon: Waves,
        color: 'text-cyan-500',
        bgClass: 'bg-cyan-500/10 border-cyan-500/20',
      };
    }

    if (movement === 'scanning' && simulationResult.treatedArea > era * 2) {
      return {
        id: 'distributed',
        name: 'Efeito Distribuído',
        description: `Varredura distribui energia sobre área maior (${simulationResult.treatedArea.toFixed(1)} cm²). Reduz pico térmico, aumenta área tratada.`,
        icon: Zap,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-500/10 border-emerald-500/20',
      };
    }

    if (thermalDose > 10) {
      return {
        id: 'thermal-dose',
        name: 'Dose Térmica Acumulada',
        description: `CEM43 = ${thermalDose.toFixed(1)} min. Dose térmica acumulada é o fator dominante. Monitorar continuamente.`,
        icon: Thermometer,
        color: 'text-amber-500',
        bgClass: 'bg-amber-500/10 border-amber-500/20',
      };
    }

    return {
      id: 'balanced',
      name: 'Efeito Balanceado',
      description: `Parâmetros equilibrados. Temperatura superficial: ${surfaceTemp.toFixed(1)}°C, alvo: ${targetTemp.toFixed(1)}°C.`,
      icon: Thermometer,
      color: 'text-muted-foreground',
      bgClass: 'bg-muted/50 border-border',
    };
  }, [config, simulationResult]);

  if (!dominantEffect) return null;

  const Icon = dominantEffect.icon;

  if (compact) {
    return (
      <div className={`min-w-0 overflow-hidden rounded-md border px-2 py-1.5 ${dominantEffect.bgClass}`}>
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${dominantEffect.color}`} />
          <div className="min-w-0 flex-1">
            <p className={`truncate text-xs font-semibold ${dominantEffect.color}`}>
              {dominantEffect.name}
            </p>
            <p className="mt-0.5 line-clamp-2 break-words text-[10px] leading-snug text-muted-foreground">
              {dominantEffect.description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${dominantEffect.bgClass}`}>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Efeito dominante
      </p>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${dominantEffect.color}`} />
        <span className={`text-sm font-semibold ${dominantEffect.color}`}>
          {dominantEffect.name}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {dominantEffect.description}
      </p>
    </div>
  );
}
