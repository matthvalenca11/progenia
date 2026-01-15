/**
 * Viewer 1: Magnetização 3D - Didático
 * Visualiza vetores Mz/Mxy, campo B0, RF pulse e relaxação T1/T2 de forma didática
 */

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Line, Text, Html, ArrowHelper as DreiArrowHelper } from "@react-three/drei";
import { useMRILabStore } from "@/stores/mriLabStore";
import { TISSUE_PROPERTIES } from "@/types/mriLabConfig";
import * as THREE from "three";
import { Button } from "@/components/ui/button";

function MagnetizationVectors({ rfActive }: { rfActive: boolean }) {
  const { config, volumeReady } = useMRILabStore();

  // STRICT: Only render if volume is ready
  if (!volumeReady) return null;

  const vectors: JSX.Element[] = [];
  const numVectors = 4; // Reduced for clarity

  // Calcular magnetização REAL baseada em física (TR/T1 para Mz, TE/T2 para Mxy)
  const tissueMagnetizations: Record<string, { mz: number; mxy: number }> = {};
  Object.keys(TISSUE_PROPERTIES).forEach((tissue) => {
    const props = TISSUE_PROPERTIES[tissue];
    const flipAngleRad = (config.flipAngle * Math.PI) / 180;
    
    // Mz (longitudinal) - T1 recovery: Mz = M0 * (1 - exp(-TR/T1))
    // After RF flip: Mz = M0 * (1 - exp(-TR/T1)) * cos(flipAngle)
    const t1Recovery = 1 - Math.exp(-config.tr / props.t1);
    const mzInitial = props.pd; // M0 (equilibrium)
    const mzAfterRF = mzInitial * t1Recovery * Math.cos(flipAngleRad);
    const mz = rfActive ? mzAfterRF : mzInitial * t1Recovery; // Show recovery if RF off
    
    // Mxy (transverse) - T2 decay: Mxy = M0 * sin(flipAngle) * exp(-TE/T2)
    // Only exists after RF pulse
    const mxyInitial = mzInitial * Math.sin(flipAngleRad);
    const t2Decay = Math.exp(-config.te / props.t2);
    const mxy = rfActive ? mxyInitial * t2Decay : 0; // No transverse component without RF

    tissueMagnetizations[tissue] = { mz, mxy };
  });

  // Criar vetores representando diferentes tecidos
  const tissueTypes = ["white_matter", "gray_matter", "csf", "fat"];
  
  for (let i = 0; i < numVectors; i++) {
    for (let j = 0; j < numVectors; j++) {
      const x = (i - numVectors / 2) * 3;
      const z = (j - numVectors / 2) * 3;

      const tissueType = tissueTypes[(i + j) % tissueTypes.length];
      const mag = tissueMagnetizations[tissueType] || { mz: 0.5, mxy: 0.3 };

      // Mz vector (longitudinal - vertical, blue)
      const mzDirection = new THREE.Vector3(0, 1, 0);
      const mzMagnitude = Math.abs(mag.mz) * 2;
      const mzColor = "#4A90E2";
      
      vectors.push(
        <ArrowHelper
          key={`mz-${i}-${j}`}
          origin={new THREE.Vector3(x, 0, z)}
          direction={mzDirection}
          length={mzMagnitude}
          color={mzColor}
          headLength={0.3}
          headWidth={0.2}
        />
      );

      // Mxy vector (transverse - horizontal, yellow)
      if (mag.mxy > 0.01) {
        const mxyDirection = new THREE.Vector3(1, 0, 0);
        const mxyMagnitude = Math.abs(mag.mxy) * 2;
        const mxyColor = "#FFD700";
        
        vectors.push(
          <ArrowHelper
            key={`mxy-${i}-${j}`}
            origin={new THREE.Vector3(x, mzMagnitude, z)}
            direction={mxyDirection}
            length={mxyMagnitude}
            color={mxyColor}
            headLength={0.3}
            headWidth={0.2}
          />
        );
      }

      // Label with values
      vectors.push(
        <Html key={`label-${i}-${j}`} position={[x + 1.5, 2, z]}>
          <div className="bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
            <div>Mz: {mag.mz.toFixed(2)}</div>
            <div>Mxy: {mag.mxy.toFixed(2)}</div>
          </div>
        </Html>
      );
    }
  }

  return <group>{vectors}</group>;
}

function ArrowHelper({ origin, direction, length, color, headLength, headWidth }: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  length: number;
  color: string;
  headLength: number;
  headWidth: number;
}) {
  const arrowHelper = useRef<THREE.ArrowHelper | null>(null);
  
  useEffect(() => {
    if (!arrowHelper.current) {
      arrowHelper.current = new THREE.ArrowHelper(direction, origin, length, color, headLength, headWidth);
    } else {
      arrowHelper.current.setDirection(direction);
      arrowHelper.current.setLength(length, headLength, headWidth);
      arrowHelper.current.setColor(color);
      arrowHelper.current.position.copy(origin);
    }
  }, [origin, direction, length, color, headLength, headWidth]);
  
  if (!arrowHelper.current) {
    arrowHelper.current = new THREE.ArrowHelper(direction, origin, length, color, headLength, headWidth);
  }
  
  return <primitive object={arrowHelper.current} />;
}

function B0FieldVisualization() {
  // Campo B0 representado como linhas de campo magnético
  const fieldLines: JSX.Element[] = [];
  const numLines = 8;

  for (let i = 0; i < numLines; i++) {
    const angle = (i / numLines) * Math.PI * 2;
    const radius = 6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    fieldLines.push(
      <Line
        key={`field-${i}`}
        points={[
          [x, -4, z],
          [x, 4, z],
        ]}
        color="#4A90E2"
        transparent
        opacity={0.2}
        lineWidth={2}
      />
    );
  }

  return <group>{fieldLines}</group>;
}

function RFPulseIndicator({ rfActive, setRfActive }: { rfActive: boolean; setRfActive: (active: boolean) => void }) {
  const { config } = useMRILabStore();
  const pulseRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (pulseRef.current) {
      const time = state.clock.getElapsedTime();
      if (rfActive) {
        pulseRef.current.position.y = Math.sin(time * 4) * 0.3;
        pulseRef.current.rotation.y = time * 2;
      }
    }

    if (flashRef.current && rfActive) {
      const time = state.clock.getElapsedTime();
      const flashIntensity = 0.7 + 0.3 * Math.sin(time * 8);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = flashIntensity;
    }
  });

  return (
    <group>
      {/* RF coil visualization */}
      <group ref={pulseRef} position={[0, 4, 0]}>
        <mesh>
          <ringGeometry args={[2.5, 3, 32]} />
          <meshBasicMaterial
            color={rfActive ? "#FFD700" : "#666"}
            opacity={rfActive ? 0.8 : 0.3}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
        {rfActive && (
          <mesh ref={flashRef}>
            <ringGeometry args={[2, 3.5, 32]} />
            <meshBasicMaterial
              color="#FFD700"
              opacity={0.8}
              transparent
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>

      {/* RF ON/OFF indicator */}
      <Html position={[0, 5.5, 0]}>
        <div className="flex flex-col items-center gap-2">
          <Button
            size="sm"
            variant={rfActive ? "default" : "outline"}
            onClick={() => setRfActive(!rfActive)}
            className="text-xs"
          >
            {rfActive ? "RF ON" : "RF OFF"}
          </Button>
          {rfActive && (
            <div className="bg-amber-500/90 text-black text-xs px-2 py-1 rounded font-mono">
              Flip: {config.flipAngle}°
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

interface Magnetization3DViewerProps {
  showDebug?: boolean;
}

export function Magnetization3DViewer({ showDebug = false }: Magnetization3DViewerProps) {
  const [rfActive, setRfActive] = useState(false);
  const store = useMRILabStore();
  const { 
    volumeReady,
    volume,
    isSimulating,
    simulationError,
  } = store;
  const storeInstanceId = store.storeInstanceId || "unknown";
  const lastSimulatedConfigHash = store.lastSimulatedConfigHash || "";
  const lastSimulationAt = store.lastSimulationAt || null;
  
  return (
    <div className="w-full h-full relative">
      <Canvas>
        <PerspectiveCamera makeDefault position={[12, 10, 12]} fov={50} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        
        {/* Grid floor */}
        <Grid args={[20, 20]} cellColor="#4A90E2" sectionColor="#2A5A9A" />
        
        {/* B0 Field */}
        <B0FieldVisualization />
        
        {/* RF Pulse Indicator */}
        <RFPulseIndicator rfActive={rfActive} setRfActive={setRfActive} />
        
        {/* Magnetization Vectors */}
        <MagnetizationVectors rfActive={rfActive} />
        
        {/* Axes helper */}
        <axesHelper args={[5]} />
        
        {/* Labels */}
        <Html position={[0, 6, 0]}>
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
            <div>B0 (Campo Principal)</div>
            <div className="text-blue-400">→ Mz (Longitudinal)</div>
            <div className="text-yellow-400">→ Mxy (Transversal)</div>
          </div>
        </Html>
        
        {/* Debug overlay (admin mode only) */}
        {showDebug && (
          <Html position={[8, 6, 0]}>
            <div className="bg-amber-500/90 text-black text-xs px-2 py-1 rounded font-mono space-y-0.5 max-w-xs">
              <div className="font-bold border-b border-black/20 pb-0.5">Store Debug</div>
              <div>ID: {storeInstanceId.slice(0, 12)}...</div>
              <div>Ready: {volumeReady ? "✅" : "❌"}</div>
              <div>Simulating: {isSimulating ? "⏳" : "✓"}</div>
              <div>Vol: {volume ? `${volume.width}×${volume.height}×${volume.depth}` : "null"}</div>
              <div>Voxels: {volume?.voxels?.length || 0}</div>
              <div className="border-t border-black/20 pt-0.5 mt-0.5">Config Hash: {lastSimulatedConfigHash.slice(0, 20)}...</div>
              <div>Last Sim: {lastSimulationAt ? new Date(lastSimulationAt).toLocaleTimeString() : "never"}</div>
              {simulationError && (
                <div className="text-red-600 border-t border-black/20 pt-0.5 mt-0.5">Error: {simulationError}</div>
              )}
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
}
