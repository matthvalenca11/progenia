/**
 * Tens3DViewer - Visualizador 3D com eletrodos e efeito de distância
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Line } from '@react-three/drei';
import { useTensLabStore, ViewerTab } from '@/stores/tensLabStore';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Eye, Zap, Target } from "lucide-react";
import * as THREE from 'three';
import { useMemo } from 'react';

function TissueLayer({ 
  yOffset, 
  height, 
  color, 
  opacity = 0.9,
  wireframe = false 
}: { 
  yOffset: number; 
  height: number; 
  color: string; 
  opacity?: number;
  wireframe?: boolean;
}) {
  return (
    <mesh position={[0, yOffset - height / 2, 0]}>
      <boxGeometry args={[10, height, 6]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={opacity}
        wireframe={wireframe}
      />
    </mesh>
  );
}

function Electrode({ 
  position, 
  label, 
  intensity,
  size 
}: { 
  position: [number, number, number]; 
  label: string; 
  intensity: number;
  size: number;
}) {
  const glowIntensity = 0.2 + intensity * 0.6;
  const radius = size * 0.12;
  
  return (
    <group position={position}>
      {/* Base do eletrodo */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[radius, radius, 0.2, 32]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Superfície condutiva com glow */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.05, 32]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          emissive="#3b82f6" 
          emissiveIntensity={glowIntensity}
          metalness={0.3}
          roughness={0.1}
        />
      </mesh>
      {/* Label */}
      <Html position={[0, 0.6, 0]} center>
        <div className="bg-slate-900/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
          {label}
        </div>
      </Html>
    </group>
  );
}

function ElectricFieldLines({ 
  distanceCm, 
  intensity,
  depth 
}: { 
  distanceCm: number; 
  intensity: number;
  depth: number;
}) {
  const lines = useMemo(() => {
    const result = [];
    const numLines = 7;
    const halfDist = distanceCm / 2;
    
    // Profundidade do campo baseada na distância e intensidade
    // Maior distância = campo mais profundo mas menos intenso na superfície
    const maxDepth = Math.min(3 + depth * 0.05, 5);
    const spreadFactor = 1 + (distanceCm - 4) * 0.1;
    
    for (let i = 0; i < numLines; i++) {
      const offset = (i / (numLines - 1) - 0.5) * 3 * spreadFactor;
      const lineDepth = maxDepth * (1 - Math.abs(offset) / 4);
      
      const points = [
        new THREE.Vector3(-halfDist * 0.9, 0.25, offset),
        new THREE.Vector3(-halfDist * 0.4, -lineDepth * 0.4, offset),
        new THREE.Vector3(0, -lineDepth, offset),
        new THREE.Vector3(halfDist * 0.4, -lineDepth * 0.4, offset),
        new THREE.Vector3(halfDist * 0.9, 0.25, offset),
      ];
      
      result.push(
        <Line 
          key={i} 
          points={points} 
          color="#60a5fa" 
          lineWidth={1.5} 
          opacity={0.3 + intensity * 0.3} 
          transparent 
        />
      );
    }
    return result;
  }, [distanceCm, intensity, depth]);

  return <group>{lines}</group>;
}

function ActivationZone({ 
  result, 
  distanceCm 
}: { 
  result: any;
  distanceCm: number;
}) {
  if (!result) return null;
  
  const depth = result.activationDepthMm / 25;
  const radius = Math.sqrt(result.activatedAreaCm2) / 2.5;
  // Maior distância = zona mais espalhada horizontalmente
  const spreadX = 1 + (distanceCm - 4) * 0.08;
  
  return (
    <mesh position={[0, -depth, 0]} scale={[spreadX, 1, 1]}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial 
        color="#a855f7" 
        transparent 
        opacity={0.25} 
        emissive="#a855f7" 
        emissiveIntensity={0.2} 
      />
    </mesh>
  );
}

function DistanceRuler({ distance }: { distance: number }) {
  const halfDist = distance / 2;
  
  return (
    <group position={[0, 0.7, 2.5]}>
      {/* Linha principal */}
      <Line 
        points={[[-halfDist, 0, 0], [halfDist, 0, 0]]} 
        color="#f59e0b" 
        lineWidth={2} 
      />
      {/* Marcadores */}
      <Line 
        points={[[-halfDist, -0.15, 0], [-halfDist, 0.15, 0]]} 
        color="#f59e0b" 
        lineWidth={2} 
      />
      <Line 
        points={[[halfDist, -0.15, 0], [halfDist, 0.15, 0]]} 
        color="#f59e0b" 
        lineWidth={2} 
      />
      {/* Label */}
      <Html position={[0, 0.35, 0]} center>
        <Badge 
          variant="outline" 
          className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-mono shadow-lg"
        >
          {distance} cm
        </Badge>
      </Html>
    </group>
  );
}

function Heatmap({ 
  distanceCm, 
  intensity,
  tissueConfig 
}: { 
  distanceCm: number; 
  intensity: number;
  tissueConfig: any;
}) {
  // Heatmap visual simplificado baseado na distância
  const skinH = tissueConfig.skinThickness * 2.5;
  const fatH = tissueConfig.fatThickness * 3;
  
  // Centro mais quente com distância menor
  const hotspotIntensity = Math.max(0.1, intensity * (6 / distanceCm));
  const spreadWidth = 1.5 + distanceCm * 0.15;
  
  return (
    <mesh position={[0, -(skinH + fatH * 0.5), 0]}>
      <planeGeometry args={[spreadWidth, fatH + skinH]} />
      <meshBasicMaterial 
        color="#ef4444" 
        transparent 
        opacity={hotspotIntensity * 0.3}
      />
    </mesh>
  );
}

export function Tens3DViewer() {
  const { 
    viewerTab, 
    setViewerTab, 
    tissueConfig, 
    electrodes, 
    intensity, 
    simulationResult 
  } = useTensLabStore();
  
  const intensityNorm = intensity / 80;

  const skinH = tissueConfig.skinThickness * 2.5;
  const fatH = tissueConfig.fatThickness * 3;
  const muscleH = tissueConfig.muscleThickness * 4;
  
  let yPos = 0;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Tabs */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <Tabs value={viewerTab} onValueChange={(v) => setViewerTab(v as ViewerTab)}>
          <TabsList className="bg-slate-800/90 backdrop-blur-sm h-8">
            <TabsTrigger value="anatomy" className="gap-1 text-[11px] h-6 px-3">
              <Eye className="h-3 w-3" />Anatomia
            </TabsTrigger>
            <TabsTrigger value="electric" className="gap-1 text-[11px] h-6 px-3">
              <Zap className="h-3 w-3" />Campo Elétrico
            </TabsTrigger>
            <TabsTrigger value="activated" className="gap-1 text-[11px] h-6 px-3">
              <Target className="h-3 w-3" />Região Ativada
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Canvas */}
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 3, 12]} fov={45} />
        <OrbitControls 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.2} 
          minPolarAngle={Math.PI / 6} 
          maxDistance={20} 
          minDistance={6}
          enableDamping
          dampingFactor={0.05}
        />
        
        <ambientLight intensity={0.3} />
        <directionalLight position={[8, 8, 5]} intensity={0.6} castShadow />
        <pointLight position={[0, 3, 0]} intensity={0.3} color="#60a5fa" />
        <fog attach="fog" args={['#0f172a', 10, 25]} />

        {/* Camadas teciduais */}
        <TissueLayer yOffset={yPos} height={skinH} color="#fda4af" />
        <TissueLayer yOffset={yPos -= skinH} height={fatH} color="#fcd34d" opacity={0.8} />
        <TissueLayer yOffset={yPos -= fatH} height={muscleH} color="#dc2626" opacity={0.75} />
        <TissueLayer yOffset={yPos -= muscleH} height={1.2} color="#64748b" />

        {/* Eletrodos */}
        <Electrode 
          position={[-electrodes.distanceCm / 2, skinH / 2 + 0.25, 0]} 
          label="+" 
          intensity={intensityNorm}
          size={electrodes.sizeCm}
        />
        <Electrode 
          position={[electrodes.distanceCm / 2, skinH / 2 + 0.25, 0]} 
          label="−" 
          intensity={intensityNorm}
          size={electrodes.sizeCm}
        />

        {/* Régua de distância */}
        <DistanceRuler distance={electrodes.distanceCm} />

        {/* Campo elétrico */}
        {(viewerTab === 'electric' || viewerTab === 'activated') && (
          <>
            <ElectricFieldLines 
              distanceCm={electrodes.distanceCm} 
              intensity={intensityNorm}
              depth={simulationResult?.activationDepthMm || 15}
            />
            <Heatmap 
              distanceCm={electrodes.distanceCm}
              intensity={intensityNorm}
              tissueConfig={tissueConfig}
            />
          </>
        )}

        {/* Zona de ativação */}
        {viewerTab === 'activated' && (
          <ActivationZone 
            result={simulationResult} 
            distanceCm={electrodes.distanceCm}
          />
        )}

        <gridHelper args={[16, 16, '#1e293b', '#0f172a']} position={[0, -7, 0]} />
      </Canvas>

      {/* Instrução */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-600">
        Arraste para rotacionar • Scroll para zoom
      </div>
    </div>
  );
}
