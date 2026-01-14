import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TensMode } from '@/lib/tensSimulation';
import { TissueConfig } from '@/types/tissueConfig';

type VisualizationMode = 'anatomical' | 'electric' | 'lesion';

interface ElectricFieldVisualizationProps {
  electrodePositions: {
    proximal: [number, number, number];
    distal: [number, number, number];
  };
  intensityNorm: number;
  frequencyHz: number;
  mode: TensMode;
  tissueConfig: TissueConfig;
  activationLevel: number;
  visualMode: VisualizationMode;
}

export function ElectricFieldVisualization({
  electrodePositions,
  intensityNorm,
  frequencyHz,
  mode,
  tissueConfig,
  activationLevel,
  visualMode,
}: ElectricFieldVisualizationProps) {
  const fieldLinesRef = useRef<THREE.Group>(null);
  const volumeRef = useRef<THREE.Mesh>(null);

  // Calculate penetration depth based on tissue configuration
  // Agora considera inclusões anatômicas
  const penetrationDepth = useMemo(() => {
    const basePenetration = intensityNorm * 0.8;
    const fatResistance = tissueConfig.fatThickness / 100;
    let depth = Math.max(0.3, Math.min(1.5, basePenetration * (1 - fatResistance * 0.3)));
    
    // Efeito das inclusões na penetração
    if (tissueConfig.inclusions) {
      tissueConfig.inclusions.forEach(inclusion => {
        if (inclusion.type === 'bone') {
          // Osso bloqueia penetração
          depth *= (1 - inclusion.span * 0.3);
        } else if (inclusion.type === 'fat') {
          // Gordura reduz penetração
          depth *= (1 - inclusion.span * 0.2);
        } else if (inclusion.type === 'muscle') {
          // Músculo facilita penetração
          depth *= (1 + inclusion.span * 0.15);
        }
      });
    }
    
    return Math.max(0.2, Math.min(2.0, depth));
  }, [intensityNorm, tissueConfig.fatThickness, tissueConfig.inclusions]);

  // Generate curved field lines - agora distorce ao redor de implantes e inclusões
  const fieldLines = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    const numLines = Math.floor(8 + intensityNorm * 12);
    
    const [x1, y1, z1] = electrodePositions.proximal;
    const [x2, y2, z2] = electrodePositions.distal;
    
    // Calcular posição do implante metálico se existir
    let metalImplantPos: { x: number; y: number; span: number } | null = null;
    if (tissueConfig.hasMetalImplant && tissueConfig.metalImplantDepth !== undefined && tissueConfig.metalImplantSpan !== undefined) {
      const centerX = (x1 + x2) / 2;
      const totalDepth = tissueConfig.skinThickness + tissueConfig.fatThickness + tissueConfig.muscleThickness;
      const implantY = -tissueConfig.metalImplantDepth * totalDepth * 5; // Converter para coordenadas 3D
      metalImplantPos = {
        x: centerX,
        y: implantY,
        span: tissueConfig.metalImplantSpan
      };
    }
    
    for (let i = 0; i < numLines; i++) {
      const points: THREE.Vector3[] = [];
      const offsetZ = (Math.random() - 0.5) * 4;
      const arcHeight = -penetrationDepth * (0.8 + Math.random() * 0.4);
      
      // Create curved path from electrode to electrode
      for (let t = 0; t <= 1; t += 0.05) {
        let x = x1 + (x2 - x1) * t;
        const baseY = y1 + (y2 - y1) * t;
        
        // Parabolic curve going downward
        const curve = Math.sin(t * Math.PI);
        let y = baseY + arcHeight * curve;
        
        // DISTORÇÃO POR IMPLANTE METÁLICO: linhas de campo são atraídas/concentradas
        if (metalImplantPos) {
          const distToImplant = Math.sqrt((x - metalImplantPos.x) ** 2 + (y - metalImplantPos.y) ** 2);
          const influenceRadius = metalImplantPos.span * 2;
          
          if (distToImplant < influenceRadius) {
            // Atrair linhas de campo para o implante (efeito de alta condutividade)
            const attraction = (1 - distToImplant / influenceRadius) * 0.4;
            const dx = (metalImplantPos.x - x) * attraction;
            const dy = (metalImplantPos.y - y) * attraction;
            x += dx;
            y += dy;
          }
        }
        
        // DISTORÇÃO POR INCLUSÕES
        if (tissueConfig.inclusions) {
          tissueConfig.inclusions.forEach(inclusion => {
            const inclusionX = x1 + (x2 - x1) * inclusion.position;
            const totalDepth = tissueConfig.skinThickness + tissueConfig.fatThickness + tissueConfig.muscleThickness;
            const inclusionY = -inclusion.depth * totalDepth * 5;
            const distToInclusion = Math.sqrt((x - inclusionX) ** 2 + (y - inclusionY) ** 2);
            const influenceRadius = inclusion.span * 1.5;
            
            if (distToInclusion < influenceRadius) {
              if (inclusion.type === 'bone') {
                // Osso desvia linhas de campo (barreira)
                const deflection = (1 - distToInclusion / influenceRadius) * 0.3;
                const normalX = (x - inclusionX) / distToInclusion;
                const normalY = (y - inclusionY) / distToInclusion;
                x += normalX * deflection;
                y += normalY * deflection;
              } else if (inclusion.type === 'muscle') {
                // Músculo atrai linhas (boa condução)
                const attraction = (1 - distToInclusion / influenceRadius) * 0.2;
                const dx = (inclusionX - x) * attraction;
                const dy = (inclusionY - y) * attraction;
                x += dx;
                y += dy;
              } else if (inclusion.type === 'fat') {
                // Gordura desvia levemente (baixa condução)
                const deflection = (1 - distToInclusion / influenceRadius) * 0.15;
                const normalX = (x - inclusionX) / distToInclusion;
                const normalY = (y - inclusionY) / distToInclusion;
                x += normalX * deflection;
                y += normalY * deflection;
              }
            }
          });
        }
        
        const z = z1 + (z2 - z1) * t + offsetZ * curve;
        
        points.push(new THREE.Vector3(x, y, z));
      }
      
      lines.push(points);
    }
    
    return lines;
  }, [electrodePositions, intensityNorm, penetrationDepth, tissueConfig]);

  // Animate field lines based on mode and frequency
  useFrame((state) => {
    if (!fieldLinesRef.current) return;

    const time = state.clock.elapsedTime;
    const speed = frequencyHz / 50;

    fieldLinesRef.current.children.forEach((line, index) => {
      const material = (line as THREE.Line).material as THREE.LineBasicMaterial;
      
      if (mode === 'convencional') {
        // Continuous flow
        const phase = (time * speed + index * 0.1) % 1;
        material.opacity = 0.3 + Math.sin(phase * Math.PI * 2) * 0.3;
      } else if (mode === 'acupuntura') {
        // Sharp pulses
        const phase = (time * speed * 2) % 1;
        material.opacity = phase < 0.1 ? 0.8 : 0.1;
      } else if (mode === 'burst') {
        // Burst pattern
        const burstPhase = (time * speed) % 1;
        const isInBurst = burstPhase < 0.3;
        const pulsePhase = (time * speed * 5) % 1;
        material.opacity = isInBurst ? (0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.4) : 0.1;
      } else if (mode === 'modulado') {
        // Modulated amplitude
        const envelope = Math.sin(time * speed * 0.5) * 0.5 + 0.5;
        const carrier = Math.sin(time * speed * 3 + index * 0.2) * 0.5 + 0.5;
        material.opacity = 0.2 + envelope * carrier * 0.6;
      }

      material.opacity *= intensityNorm;
    });

    // Animate volumetric field
    if (volumeRef.current) {
      const material = volumeRef.current.material as THREE.MeshBasicMaterial;
      const pulse = Math.sin(time * speed * 2) * 0.5 + 0.5;
      material.opacity = intensityNorm * pulse * 0.15;
    }
  });

  return (
    <group>
      {/* Field Lines */}
      <group ref={fieldLinesRef}>
        {fieldLines.map((points, index) => {
          const curve = new THREE.CatmullRomCurve3(points);
          const linePoints = curve.getPoints(50);
          const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
          const material = new THREE.LineBasicMaterial({
            color: visualMode === 'lesion' ? '#ff6666' : '#4499ff',
            transparent: true,
            opacity: 0.5,
          });
          
          return (
            <primitive key={index} object={new THREE.Line(geometry, material)} />
          );
        })}
      </group>

      {/* Volumetric field representation (fog-like) */}
      <mesh
        ref={volumeRef}
        position={[
          (electrodePositions.proximal[0] + electrodePositions.distal[0]) / 2,
          -penetrationDepth / 2,
          0,
        ]}
      >
        <boxGeometry
          args={[
            Math.abs(electrodePositions.distal[0] - electrodePositions.proximal[0]) + 2,
            penetrationDepth * 1.5,
            4,
          ]}
        />
        <meshBasicMaterial
          color={visualMode === 'lesion' ? '#ff4444' : '#4499ff'}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Particle system for enhanced field visualization */}
      {intensityNorm > 0.4 && (
        <FieldParticles
          electrodePositions={electrodePositions}
          penetrationDepth={penetrationDepth}
          intensity={intensityNorm}
          frequency={frequencyHz}
        />
      )}
    </group>
  );
}

// Enhanced particle system for field visualization
function FieldParticles({
  electrodePositions,
  penetrationDepth,
  intensity,
  frequency,
}: {
  electrodePositions: { proximal: [number, number, number]; distal: [number, number, number] };
  penetrationDepth: number;
  intensity: number;
  frequency: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const numParticles = Math.floor(50 + intensity * 100);
    const positions = new Float32Array(numParticles * 3);
    
    const [x1, y1] = electrodePositions.proximal;
    const [x2, y2] = electrodePositions.distal;
    
    for (let i = 0; i < numParticles; i++) {
      const t = Math.random();
      const x = x1 + (x2 - x1) * t;
      const curve = Math.sin(t * Math.PI);
      const y = y1 - penetrationDepth * curve * Math.random();
      const z = (Math.random() - 0.5) * 3;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [electrodePositions, penetrationDepth, intensity]);

  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const time = state.clock.elapsedTime;
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < positions.length / 3; i++) {
      const offset = Math.sin(time * frequency / 10 + i * 0.1) * 0.02;
      positions[i * 3 + 1] += offset;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} geometry={particleGeometry}>
      <pointsMaterial
        size={0.05}
        color="#66ccff"
        transparent
        opacity={intensity * 0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
