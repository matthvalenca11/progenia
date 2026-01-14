/**
 * DominantEffect - Mostra o efeito dominante na simulação
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';
import { Thermometer, AlertTriangle, Waves, Zap } from 'lucide-react';

interface DominantEffect {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

export function DominantEffect() {
  const { config, simulationResult } = useUltrasoundTherapyStore();

  const dominantEffect = useMemo((): DominantEffect | null => {
    if (!simulationResult) return null;

    const { surfaceTemp, targetTemp, maxTemp, periostealRisk, thermalDose } = simulationResult;
    const { frequency, era, intensity, mode, movement, coupling } = config;

    // Rule 1: High periosteal risk
    if (periostealRisk > 0.6) {
      return {
        id: 'periosteal-risk',
        name: 'Risco Periosteal',
        description: `Risco alto próximo ao osso (${(periostealRisk * 100).toFixed(0)}%). Frequência ${frequency} MHz + intensidade ${intensity} W/cm² podem concentrar energia no osso.`,
        icon: AlertTriangle,
        color: 'text-red-400',
      };
    }

    // Rule 2: Superficial heating (high frequency, small ERA, stationary)
    if (frequency >= 2.5 && era <= 4 && movement === 'stationary' && surfaceTemp > targetTemp + 1) {
      return {
        id: 'superficial-heating',
        name: 'Aquecimento Superficial',
        description: `Frequência alta (${frequency} MHz) + ERA pequena (${era} cm²) + parado concentram energia na superfície. Temperatura superficial: ${surfaceTemp.toFixed(1)}°C.`,
        icon: Thermometer,
        color: 'text-orange-400',
      };
    }

    // Rule 3: Deep heating (low frequency, large ERA, continuous)
    if (frequency <= 1.5 && era >= 6 && mode === 'continuous' && targetTemp > surfaceTemp + 1) {
      return {
        id: 'deep-heating',
        name: 'Aquecimento Profundo',
        description: `Frequência baixa (${frequency} MHz) + ERA grande (${era} cm²) + contínuo permitem penetração profunda. Temperatura no alvo: ${targetTemp.toFixed(1)}°C.`,
        icon: Thermometer,
        color: 'text-blue-400',
      };
    }

    // Rule 4: Cavitation risk (pulsed + high intensity + high frequency)
    if (mode === 'pulsed' && intensity >= 2.0 && frequency >= 2.5) {
      return {
        id: 'cavitation',
        name: 'Efeito Mecânico / Cavitação',
        description: `Modo pulsado + intensidade alta (${intensity} W/cm²) + frequência alta (${frequency} MHz) podem causar cavitação. Efeito mecânico dominante.`,
        icon: Waves,
        color: 'text-cyan-400',
      };
    }

    // Rule 5: Distributed effect (scanning)
    if (movement === 'scanning' && simulationResult.treatedArea > era * 2) {
      return {
        id: 'distributed',
        name: 'Efeito Distribuído',
        description: `Varredura distribui energia sobre área maior (${simulationResult.treatedArea.toFixed(1)} cm²). Reduz pico térmico, aumenta área tratada.`,
        icon: Zap,
        color: 'text-green-400',
      };
    }

    // Rule 6: High thermal dose
    if (thermalDose > 10) {
      return {
        id: 'thermal-dose',
        name: 'Dose Térmica Acumulada',
        description: `CEM43 = ${thermalDose.toFixed(1)} min. Dose térmica acumulada é o fator dominante. Monitorar continuamente.`,
        icon: Thermometer,
        color: 'text-amber-400',
      };
    }

    // Default: Balanced effect
    return {
      id: 'balanced',
      name: 'Efeito Balanceado',
      description: `Parâmetros equilibrados. Temperatura superficial: ${surfaceTemp.toFixed(1)}°C, alvo: ${targetTemp.toFixed(1)}°C.`,
      icon: Thermometer,
      color: 'text-slate-400',
    };
  }, [config, simulationResult]);

  if (!dominantEffect) return null;

  const Icon = dominantEffect.icon;

  return (
    <Alert className="bg-slate-800/50 border-slate-700">
      <Icon className={`h-4 w-4 ${dominantEffect.color}`} />
      <AlertDescription>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={`text-xs ${dominantEffect.color} border-current`}>
            Efeito Dominante
          </Badge>
          <span className={`text-sm font-medium ${dominantEffect.color}`}>
            {dominantEffect.name}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{dominantEffect.description}</p>
      </AlertDescription>
    </Alert>
  );
}
