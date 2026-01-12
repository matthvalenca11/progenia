/**
 * Tens3DViewer - Visualizador 3D principal com eletrodos arrastáveis
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Line } from '@react-three/drei';
import { useTensLabStore, ViewerTab } from '@/stores/tensLabStore';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Eye, Zap, Target } from "lucide-react";
import * as THREE from 'three';

function TissueLayer({ yOffset, height, color, opacity = 0.9 }: { yOffset: number; height: number; color: string; opacity?: number }) {
  return (
    <mesh position={[0, yOffset - height / 2, 0]}>
      <boxGeometry args={[12, height, 8]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function Electrode({ position, label, intensity }: { position: [number, number, number]; label: string; intensity: number }) {
  const glowIntensity = 0.3 + intensity * 0.7;
  
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.3, 32]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1, 32]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={glowIntensity} />
      </mesh>
      <Html position={[0, 0.8, 0]} center>
        <div className="bg-slate-900/80 text-white text-xs font-bold px-2 py-1 rounded">{label}</div>
      </Html>
    </group>
  );
}

function ElectricFieldLines({ electrodes, intensity }: { electrodes: any; intensity: number }) {
  const lines = [];
  const numLines = 5;
  const halfDist = electrodes.distanceCm / 2;
  
  for (let i = 0; i < numLines; i++) {
    const offset = (i / (numLines - 1) - 0.5) * 4;
    const depth = 1 + intensity * 2;
    const points = [
      new THREE.Vector3(-halfDist, 0, offset),
      new THREE.Vector3(-halfDist * 0.5, -depth * 0.5, offset),
      new THREE.Vector3(0, -depth, offset),
      new THREE.Vector3(halfDist * 0.5, -depth * 0.5, offset),
      new THREE.Vector3(halfDist, 0, offset),
    ];
    lines.push(
      <Line key={i} points={points} color="#3b82f6" lineWidth={2} opacity={0.4 + intensity * 0.4} transparent />
    );
  }
  return <>{lines}</>;
}

function ActivationZone({ result }: { result: any }) {
  if (!result) return null;
  const depth = result.activationDepthMm / 30;
  const radius = Math.sqrt(result.activatedAreaCm2) / 3;
  
  return (
    <mesh position={[0, -depth, 0]}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial color="#8b5cf6" transparent opacity={0.3} emissive="#8b5cf6" emissiveIntensity={0.3} />
    </mesh>
  );
}

function DistanceRuler({ distance }: { distance: number }) {
  const halfDist = distance / 2;
  return (
    <group position={[0, 0.8, 3]}>
      <Line points={[[-halfDist, 0, 0], [halfDist, 0, 0]]} color="#f59e0b" lineWidth={2} />
      <Line points={[[-halfDist, -0.2, 0], [-halfDist, 0.2, 0]]} color="#f59e0b" lineWidth={2} />
      <Line points={[[halfDist, -0.2, 0], [halfDist, 0.2, 0]]} color="#f59e0b" lineWidth={2} />
      <Html position={[0, 0.4, 0]} center>
        <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/50 text-xs">
          {distance} cm
        </Badge>
      </Html>
    </group>
  );
}

export function Tens3DViewer() {
  const { viewerTab, setViewerTab, tissueConfig, electrodes, intensity, simulationResult } = useTensLabStore();
  const intensityNorm = intensity / 80;

  const skinH = tissueConfig.skinThickness * 3;
  const fatH = tissueConfig.fatThickness * 4;
  const muscleH = tissueConfig.muscleThickness * 5;
  
  let yPos = 0;

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden border">
      {/* Tabs */}
      <div className="absolute top-4 left-4 z-10">
        <Tabs value={viewerTab} onValueChange={(v) => setViewerTab(v as ViewerTab)}>
          <TabsList className="bg-slate-800/80 backdrop-blur-sm">
            <TabsTrigger value="anatomy" className="gap-1.5 text-xs"><Eye className="h-3.5 w-3.5" />Anatomia 3D</TabsTrigger>
            <TabsTrigger value="electric" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" />Campo Elétrico</TabsTrigger>
            <TabsTrigger value="activated" className="gap-1.5 text-xs"><Target className="h-3.5 w-3.5" />Região Ativada</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Quick info overlay */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg text-xs space-y-1">
        <div className="flex justify-between gap-4 text-slate-300">
          <span>Distância:</span>
          <span className="font-mono text-cyan-400">{electrodes.distanceCm} cm</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-300">
          <span>Profundidade:</span>
          <span className="font-mono text-cyan-400">{simulationResult?.activationDepthMm.toFixed(0) || 0} mm</span>
        </div>
      </div>

      {/* Canvas */}
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 4, 14]} fov={45} />
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 6} maxDistance={25} minDistance={8} />
        
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.7} castShadow />
        <pointLight position={[0, 5, 0]} intensity={0.4} color="#60a5fa" />
        <fog attach="fog" args={['#0f172a', 12, 30]} />

        {/* Tissue Layers */}
        <TissueLayer yOffset={yPos} height={skinH} color="#fda4af" />
        <TissueLayer yOffset={yPos -= skinH} height={fatH} color="#fcd34d" opacity={0.85} />
        <TissueLayer yOffset={yPos -= fatH} height={muscleH} color="#ef4444" opacity={0.8} />
        <TissueLayer yOffset={yPos -= muscleH} height={1.5} color="#94a3b8" />

        {/* Electrodes */}
        <Electrode position={[-electrodes.distanceCm / 2, skinH / 2 + 0.3, 0]} label="+" intensity={intensityNorm} />
        <Electrode position={[electrodes.distanceCm / 2, skinH / 2 + 0.3, 0]} label="−" intensity={intensityNorm} />

        {/* Distance Ruler */}
        <DistanceRuler distance={electrodes.distanceCm} />

        {/* Electric Field */}
        {(viewerTab === 'electric' || viewerTab === 'activated') && (
          <ElectricFieldLines electrodes={electrodes} intensity={intensityNorm} />
        )}

        {/* Activation Zone */}
        {viewerTab === 'activated' && <ActivationZone result={simulationResult} />}

        <gridHelper args={[20, 20, '#334155', '#1e293b']} position={[0, -8, 0]} />
      </Canvas>

      <div className="absolute bottom-4 left-4 text-xs text-slate-500">
        Arraste para rotacionar • Scroll para zoom
      </div>
    </div>
  );
}
