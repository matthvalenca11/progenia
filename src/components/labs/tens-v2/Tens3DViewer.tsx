/**
 * Tens3DViewer - Visualizador 3D com eletrodos e efeito de distância
 * Agora usa os mesmos componentes avançados do builder para visualização idêntica
 */

import { Canvas } from '@react-three/fiber';
import { useTensLabStore, ViewerTab } from '@/stores/tensLabStore';
import { Tens3DSceneSetup } from '@/components/labs/tens3d/Tens3DSceneSetup';
import { TissueLayersModel } from '@/components/labs/tens3d/TissueLayersModel';
import { ElectricFieldVisualization } from '@/components/labs/tens3d/ElectricFieldVisualization';
import { ElectrodeModel } from '@/components/labs/tens3d/ElectrodeModel';
import { StressHeatmap } from '@/components/labs/tens3d/StressHeatmap';
import { MetalImplantHotspot } from '@/components/labs/tens3d/MetalImplantHotspot';
import { ThermalHotspot } from '@/components/labs/tens3d/ThermalHotspot';
import { useMemo, useEffect, useState } from 'react';
import { TensMode } from '@/lib/tensSimulation';
import { RiskResult } from '@/types/tissueConfig';

type VisualizationMode = 'anatomical' | 'electric' | 'lesion';

export function Tens3DViewer() {
  const { 
    viewerTab, 
    setViewerTab, 
    tissueConfig, 
    electrodes, 
    intensity, 
    frequency,
    pulseWidth,
    mode,
    simulationResult 
  } = useTensLabStore();
  
  // Normalizar parâmetros (igual ao builder)
  const intensityNorm = Math.min(1, intensity / 80);
  const pulseNorm = (pulseWidth - 50) / (400 - 50);
  
  // Calcular lesionIndex (igual ao builder)
  const lesionIndex = useMemo(() => {
    let index = 0;
    
    if (simulationResult?.riskLevel === "alto") index += 0.7;
    else if (simulationResult?.riskLevel === "moderado") index += 0.4;
    
    index += intensityNorm * 0.3;
    index += pulseNorm * 0.3;
    
    if (tissueConfig.hasMetalImplant && intensityNorm > 0.5) index += 0.4;
    if (tissueConfig.boneDepth < 0.4 && intensityNorm > 0.6) index += 0.3;
    if (tissueConfig.skinThickness < 0.2 && intensityNorm > 0.5) index += 0.25;
    
    return Math.min(1, Math.max(0, index));
  }, [intensityNorm, pulseNorm, tissueConfig, simulationResult]);

  // Mapear viewerTab para visualMode
  const visualMode: VisualizationMode = useMemo(() => {
    if (viewerTab === 'anatomy') return 'anatomical';
    if (viewerTab === 'electric') return 'electric';
    if (viewerTab === 'activated') return 'electric'; // Mostrar campo elétrico na zona ativada
    return 'electric';
  }, [viewerTab]);

  // Posições dos eletrodos baseadas na distância
  const [electrodePositions, setElectrodePositions] = useState({
    proximal: [-electrodes.distanceCm / 2, 0, 0] as [number, number, number],
    distal: [electrodes.distanceCm / 2, 0, 0] as [number, number, number],
  });

  useEffect(() => {
    setElectrodePositions({
      proximal: [-electrodes.distanceCm / 2, 0, 0] as [number, number, number],
      distal: [electrodes.distanceCm / 2, 0, 0] as [number, number, number],
    });
  }, [electrodes.distanceCm]);

  // Criar RiskResult a partir do simulationResult
  const riskResult: RiskResult = useMemo(() => {
    if (!simulationResult) {
      return {
        riskLevel: 'baixo',
        riskScore: 0,
        messages: [],
      };
    }
    return {
      riskLevel: simulationResult.riskLevel,
      riskScore: simulationResult.riskScore,
      messages: simulationResult.riskMessages || [],
    };
  }, [simulationResult]);

  // Calcular activationLevel e comfortLevel
  const activationLevel = simulationResult?.sensoryActivation || 0;
  const comfortLevel = simulationResult?.comfortScore || 0;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Canvas */}
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
        {/* Configuração compartilhada da cena (câmera, controles, iluminação, fog) - igual ao builder */}
        <Tens3DSceneSetup />

        {/* Tissue Layers - usando o mesmo componente do builder */}
        <TissueLayersModel
          key={`${tissueConfig.skinThickness}-${tissueConfig.fatThickness}-${tissueConfig.muscleThickness}-${tissueConfig.hasMetalImplant}`}
          tissueConfig={tissueConfig}
          visualMode={visualMode}
          intensityNorm={intensityNorm}
          lesionIndex={lesionIndex}
        />

        {/* Electrodes - usando o mesmo componente do builder */}
        <ElectrodeModel
          position={electrodePositions.proximal}
          label="+"
          isActive={intensity > 0}
          intensity={Math.max(0.2, intensityNorm)}
        />
        <ElectrodeModel
          position={electrodePositions.distal}
          label="-"
          isActive={intensity > 0}
          intensity={Math.max(0.2, intensityNorm)}
        />

        {/* Electric Field Visualization - sempre mostrar algo mesmo com intensidade baixa */}
        {(visualMode === 'electric' || viewerTab === 'activated') && (
          <ElectricFieldVisualization
            electrodePositions={electrodePositions}
            intensityNorm={Math.max(0.15, intensityNorm)}
            frequencyHz={frequency}
            mode={mode as TensMode}
            tissueConfig={tissueConfig}
            activationLevel={activationLevel}
            visualMode={visualMode}
          />
        )}

        {/* Stress/Lesion Heatmap - sempre mostrar quando há risco significativo */}
        {lesionIndex > 0.2 && (
          <StressHeatmap
            electrodePositions={electrodePositions}
            intensityNorm={intensityNorm}
            pulseNorm={pulseNorm}
            tissueConfig={tissueConfig}
            riskResult={riskResult}
          />
        )}

        {/* Metal Implant Hotspot - sempre visível quando há implante metálico */}
        {tissueConfig.hasMetalImplant && simulationResult?.metalHotspot && simulationResult.metalHotspot.intensity > 0.1 && (
          <MetalImplantHotspot
            electrodePositions={electrodePositions}
            metalHotspot={simulationResult.metalHotspot}
            tissueConfig={tissueConfig}
            intensityNorm={intensityNorm}
          />
        )}

        {/* Thermal Hotspot - sempre visível quando há implante metálico */}
        {tissueConfig.hasMetalImplant && simulationResult?.thermalHotspot && simulationResult.thermalHotspot.intensity > 0.15 && (
          <ThermalHotspot
            electrodePositions={electrodePositions}
            thermalHotspot={simulationResult.thermalHotspot}
            tissueConfig={tissueConfig}
          />
        )}

        {/* Grid Helper (subtle) - aumentado para acomodar eletrodos mais distantes */}
        <gridHelper args={[24, 24, '#334155', '#1e293b']} position={[0, -4, 0]} />
      </Canvas>

      {/* Instrução */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-600">
        Arraste para rotacionar • Scroll para zoom
      </div>
    </div>
  );
}
