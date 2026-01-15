/**
 * Viewer 1: Magnetização 3D
 * Visualiza vetores de magnetização, campo B0, RF pulse e relaxação T1/T2
 */

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid } from "@react-three/drei";
import { useMRILabStore } from "@/stores/mriLabStore";
import { TISSUE_PROPERTIES } from "@/types/mriLabConfig";
import * as THREE from "three";

function MagnetizationVectors() {
  const { config, simulationResult } = useMRILabStore();
  
  if (!simulationResult) return null;
  
  const vectors: JSX.Element[] = [];
  const numVectors = 6; // Reduced for clarity
  
  // Calcular magnetização média por tecido
  const tissueMagnetizations: Record<string, { mz: number; mxy: number }> = {};
  Object.keys(TISSUE_PROPERTIES).forEach((tissue) => {
    const props = TISSUE_PROPERTIES[tissue];
    const t1Recovery = 1 - Math.exp(-config.tr / props.t1);
    const flipAngleRad = (config.flipAngle * Math.PI) / 180;
    const t2Decay = Math.exp(-config.te / props.t2);
    
    const mz = props.pd * t1Recovery * Math.cos(flipAngleRad);
    const mxy = props.pd * t1Recovery * Math.sin(flipAngleRad) * t2Decay;
    
    tissueMagnetizations[tissue] = { mz, mxy };
  });
  
  // Criar grid de vetores representando diferentes tecidos
  for (let i = 0; i < numVectors; i++) {
    for (let j = 0; j < numVectors; j++) {
      const x = (i - numVectors / 2) * 2;
      const z = (j - numVectors / 2) * 2;
      
      // Alternar tipos de tecido
      const tissueTypes = ["white_matter", "gray_matter", "csf", "fat"];
      const tissueType = tissueTypes[(i + j) % tissueTypes.length];
      const mag = tissueMagnetizations[tissueType] || { mz: 0.5, mxy: 0.3 };
      
      // Direção do vetor (longitudinal Mz + transversal Mxy)
      const direction = new THREE.Vector3(0, mag.mz, mag.mxy);
      direction.normalize();
      
      const magnitude = Math.sqrt(mag.mz * mag.mz + mag.mxy * mag.mxy);
      const color = TISSUE_PROPERTIES[tissueType].color || "#ffffff";
      
      // Create arrow using THREE.ArrowHelper
      const arrowHelper = new THREE.ArrowHelper(
        direction,
        new THREE.Vector3(x, 0, z),
        magnitude * 3, // Scale for visibility
        color,
        0.4,
        0.25
      );
      
      vectors.push(
        <primitive key={`vec-${i}-${j}`} object={arrowHelper} />
      );
    }
  }
  
  return <group>{vectors}</group>;
}

function B0FieldVisualization() {
  const { config } = useMRILabStore();
  
  // Campo B0 representado como linhas de campo magnético
  const fieldLines: JSX.Element[] = [];
  const numLines = 12;
  
  for (let i = 0; i < numLines; i++) {
    const angle = (i / numLines) * Math.PI * 2;
    const radius = 8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Linha de campo (paralela ao eixo Y - direção do B0)
    fieldLines.push(
      <line key={`field-${i}`} position={[x, 0, z]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([x, -5, z, x, 5, z])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#4A90E2" opacity={0.3} transparent />
      </line>
    );
  }
  
  return <group>{fieldLines}</group>;
}

function RFPulseAnimation() {
  const { config } = useMRILabStore();
  const pulseRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (pulseRef.current) {
      // Animação de pulso RF (ondas se propagando)
      const time = state.clock.getElapsedTime();
      const pulseSpeed = 2;
      pulseRef.current.position.y = Math.sin(time * pulseSpeed) * 0.5;
      pulseRef.current.rotation.y = time * 0.5;
    }
    
    if (flashRef.current) {
      // Flash effect when RF pulse is "active"
      const time = state.clock.getElapsedTime();
      const flashIntensity = 0.5 + 0.5 * Math.sin(time * 4);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = flashIntensity * 0.8;
    }
  });
  
  // RF coil visualization with flash effect
  return (
    <group ref={pulseRef} position={[0, 3, 0]}>
      <mesh>
        <ringGeometry args={[3, 3.5, 32]} />
        <meshBasicMaterial color="#FFD700" opacity={0.6} transparent side={THREE.DoubleSide} />
      </mesh>
      {/* Flash effect */}
      <mesh ref={flashRef}>
        <ringGeometry args={[2.5, 4, 32]} />
        <meshBasicMaterial color="#FFD700" opacity={0.8} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Magnetization3DViewer() {
  return (
    <div className="w-full h-full">
      <Canvas>
        <PerspectiveCamera makeDefault position={[10, 8, 10]} fov={50} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        
        {/* Grid floor */}
        <Grid args={[20, 20]} cellColor="#4A90E2" sectionColor="#2A5A9A" />
        
        {/* B0 Field */}
        <B0FieldVisualization />
        
        {/* RF Pulse Animation */}
        <RFPulseAnimation />
        
        {/* Magnetization Vectors */}
        <MagnetizationVectors />
        
        {/* Axes helper */}
        <axesHelper args={[5]} />
      </Canvas>
    </div>
  );
}
