import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useState, useMemo, useEffect } from 'react';
import { TensMode } from '@/lib/tensSimulation';
import { TissueConfig, RiskResult } from '@/types/tissueConfig';
import { TissueLayersModel } from './TissueLayersModel';
import { ElectricFieldVisualization } from './ElectricFieldVisualization';
import { ElectrodeModel } from './ElectrodeModel';
import { StressHeatmap } from './StressHeatmap';
import { Button } from '@/components/ui/button';
import { Eye, Zap, AlertTriangle } from 'lucide-react';

type VisualizationMode = 'anatomical' | 'electric' | 'lesion';

interface Tens3DSimulatorProps {
  frequencyHz: number;
  pulseWidthUs: number;
  intensitymA: number;
  mode: TensMode;
  activationLevel: number;
  comfortLevel: number;
  tissueConfig: TissueConfig;
  riskResult: RiskResult;
  compact?: boolean;
  electrodeDistance?: number;
}

export function Tens3DSimulator({
  frequencyHz,
  pulseWidthUs,
  intensitymA,
  mode,
  activationLevel,
  comfortLevel,
  tissueConfig,
  riskResult,
  compact = false,
  electrodeDistance = 6,
}: Tens3DSimulatorProps) {
  const [visualMode, setVisualMode] = useState<VisualizationMode>('electric');
  const [electrodePositions, setElectrodePositions] = useState({
    proximal: [-electrodeDistance / 2, 0, 0] as [number, number, number],
    distal: [electrodeDistance / 2, 0, 0] as [number, number, number],
  });

  // Atualizar posições quando a distância mudar
  useEffect(() => {
    setElectrodePositions({
      proximal: [-electrodeDistance / 2, 0, 0] as [number, number, number],
      distal: [electrodeDistance / 2, 0, 0] as [number, number, number],
    });
  }, [electrodeDistance]);

  // Normalize parameters
  const intensityNorm = Math.min(1, intensitymA / 80);
  const pulseNorm = (pulseWidthUs - 50) / (400 - 50);
  const freqNorm = (frequencyHz - 1) / (200 - 1);
  
  // Calculate lesion index
  const lesionIndex = useMemo(() => {
    let index = 0;
    
    if (riskResult.riskLevel === "alto") index += 0.7;
    else if (riskResult.riskLevel === "moderado") index += 0.4;
    
    index += intensityNorm * 0.3;
    index += pulseNorm * 0.3;
    
    if (tissueConfig.hasMetalImplant && intensityNorm > 0.5) index += 0.4;
    if (tissueConfig.boneDepth < 0.4 && intensityNorm > 0.6) index += 0.3;
    if (tissueConfig.skinThickness < 0.2 && intensityNorm > 0.5) index += 0.25;
    
    return Math.min(1, Math.max(0, index));
  }, [intensityNorm, pulseNorm, tissueConfig, riskResult]);

  const canvasHeight = compact ? '500px' : '600px';

  return (
    <div className={`relative w-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-xl overflow-hidden border border-slate-800 touch-none`} style={{ height: canvasHeight }}>
      {/* Mode Selector */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <Button
          variant={visualMode === 'anatomical' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVisualMode('anatomical')}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Anatômico
        </Button>
        <Button
          variant={visualMode === 'electric' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVisualMode('electric')}
          className="gap-2"
        >
          <Zap className="w-4 h-4" />
          Campo Elétrico
        </Button>
        <Button
          variant={visualMode === 'lesion' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVisualMode('lesion')}
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          Lesão/Risco
        </Button>
      </div>

      {/* Info Panel */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-slate-700 text-sm">
        <div className="space-y-1 text-slate-300">
          <div className="flex justify-between gap-4">
            <span>Intensidade:</span>
            <span className="font-mono text-cyan-400">{intensitymA.toFixed(1)} mA</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Frequência:</span>
            <span className="font-mono text-cyan-400">{frequencyHz} Hz</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Largura:</span>
            <span className="font-mono text-cyan-400">{pulseWidthUs} µs</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Risco:</span>
            <span className={`font-semibold ${
              riskResult.riskLevel === 'alto' ? 'text-red-400' :
              riskResult.riskLevel === 'moderado' ? 'text-amber-400' :
              'text-green-400'
            }`}>
              {riskResult.riskLevel.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas 
        gl={{ 
          preserveDrawingBuffer: true, 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        }}
        shadows
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[0, 3, 12]} fov={50} />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 4}
          maxDistance={20}
          minDistance={8}
          enableDamping={true}
          dampingFactor={0.05}
        />

        {/* Enhanced Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={0.4} />
        <pointLight position={[0, 5, 0]} intensity={0.5} color="#60a5fa" />
        <hemisphereLight args={['#ffffff', '#444444', 0.3]} />
        
        {/* Subtle fog for depth */}
        <fog attach="fog" args={['#0f172a', 10, 25]} />

        {/* Tissue Layers - key forces re-render when config changes */}
        <TissueLayersModel
          key={`${tissueConfig.skinThickness}-${tissueConfig.fatThickness}-${tissueConfig.muscleThickness}-${tissueConfig.hasMetalImplant}`}
          tissueConfig={tissueConfig}
          visualMode={visualMode}
          intensityNorm={intensityNorm}
          lesionIndex={lesionIndex}
        />

        {/* Electrodes - sempre visíveis */}
        <ElectrodeModel
          position={electrodePositions.proximal}
          label="+"
          isActive={intensitymA > 0}
          intensity={Math.max(0.2, intensityNorm)}
        />
        <ElectrodeModel
          position={electrodePositions.distal}
          label="-"
          isActive={intensitymA > 0}
          intensity={Math.max(0.2, intensityNorm)}
        />

        {/* Electric Field Visualization - sempre mostrar algo mesmo com intensidade baixa */}
        {(visualMode === 'electric' || visualMode === 'lesion') && (
          <ElectricFieldVisualization
            electrodePositions={electrodePositions}
            intensityNorm={Math.max(0.15, intensityNorm)}
            frequencyHz={frequencyHz}
            mode={mode}
            tissueConfig={tissueConfig}
            activationLevel={activationLevel}
            visualMode={visualMode}
          />
        )}

        {/* Stress/Lesion Heatmap */}
        {visualMode === 'lesion' && (
          <StressHeatmap
            electrodePositions={electrodePositions}
            intensityNorm={intensityNorm}
            pulseNorm={pulseNorm}
            tissueConfig={tissueConfig}
            riskResult={riskResult}
          />
        )}

        {/* Grid Helper (subtle) */}
        <gridHelper args={[20, 20, '#334155', '#1e293b']} position={[0, -4, 0]} />
      </Canvas>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-400">
        Arraste para rotacionar • Scroll para zoom
      </div>
    </div>
  );
}
