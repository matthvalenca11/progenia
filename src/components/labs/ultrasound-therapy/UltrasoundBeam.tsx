/**
 * UltrasoundBeam - Visualiza o feixe acústico
 */

import { useMemo } from 'react';
import { Cone, Sphere } from '@react-three/drei';

interface UltrasoundBeamProps {
  frequency: number;
  intensity: number;
  era: number;
  effectiveDepth: number;
  penetrationDepth: number;
  coupling?: "good" | "poor";
  position?: { x: number; y: number }; // V5: 2D position
}

export function UltrasoundBeam({ 
  frequency, 
  intensity, 
  era, 
  effectiveDepth, 
  penetrationDepth,
  coupling = "good",
  position = { x: 0, y: 0 }
}: UltrasoundBeamProps) {
  // V6: Beam calculation - starts from face radius (geometrically correct)
  const faceRadius = useMemo(() => Math.sqrt(era / Math.PI), [era]);
  const nearFieldLength = useMemo(() => Math.pow(faceRadius, 2) * frequency / 1.5, [faceRadius, frequency]);
  
  // Beam width at different depths
  const beamWidthAtDepth = useMemo(() => {
    // Ensure we have a valid depth for calculation
    const depth = Math.max(0.1, effectiveDepth); // Minimum depth to avoid division issues
    
    if (depth < nearFieldLength) {
      // Near field: approximately constant width (slight divergence)
      return faceRadius * 2 * 1.1; // Starts at face diameter, slight divergence
    } else {
      // Far field: diverges
      // Prevent division by zero or very small values
      const denominator = faceRadius * frequency;
      if (denominator < 0.01) {
        // Fallback for very small values
        return faceRadius * 2 * 1.2;
      }
      const divergenceAngle = 1.22 / denominator;
      const divergence = Math.tan(divergenceAngle);
      // Clamp divergence to prevent extreme values
      const clampedDivergence = Math.min(divergence, 0.5); // Max 0.5 rad (~28 degrees)
      return faceRadius * 2 + 2 * depth * clampedDivergence;
    }
  }, [faceRadius, frequency, effectiveDepth, nearFieldLength]);
  
  // V6: Beam starts at face (y=0) with face radius
  const beamStartY = 0; // Surface level
  const beamWidthAtSurface = faceRadius * 2; // Exactly face diameter
  
  // Ensure minimum cone height to prevent invisible beam
  const minConeHeight = 0.5; // Minimum visible height
  const coneHeight = Math.max(minConeHeight, effectiveDepth);
  
  const coneTopRadius = faceRadius; // Starts at face radius (geometrically correct)
  
  // Calculate bottom radius, ensuring it's always >= top radius (cone diverges)
  const calculatedBottomRadius = beamWidthAtDepth / 2;
  const coneBottomRadius = Math.max(coneTopRadius * 1.01, calculatedBottomRadius); // Always slightly larger than top
  
  // Coupling affects beam visibility and intensity
  const couplingFactor = coupling === "good" ? 1.0 : 0.7;
  const intensityNorm = Math.min(1, intensity / 2.5) * couplingFactor;
  const opacity = 0.15 + intensityNorm * 0.35;
  const emissiveIntensity = intensityNorm * 0.6;
  
  // Poor coupling shows more surface scattering
  const surfaceScatter = coupling === "poor" ? 0.3 : 0;

  // V6: Position offset
  const xOffset = position.x * 8;
  const zOffset = position.y * 3;
  
  return (
    // Render after translucent tissue layers so the beam stays visible inside the volume
    <group position={[xOffset, beamStartY, zOffset]} renderOrder={10}>
      {/* V6: Surface scatter for poor coupling - starts at face level */}
      {surfaceScatter > 0 && (
        <>
          {/* Scattered beam at surface - starts from face */}
          <Cone
            args={[coneTopRadius * 1.5, 0.3, 16]}
            position={[0, -0.15, 0]}
            rotation={[Math.PI, 0, 0]}
          >
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#fbbf24"
              emissiveIntensity={surfaceScatter * 0.6}
              opacity={surfaceScatter * 0.5}
              transparent
            />
          </Cone>
          {/* Scattered particles - positioned relative to face */}
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * Math.PI * 2;
            const radius = coneTopRadius * 0.8;
            return (
              <Sphere
                key={i}
                args={[0.1, 8, 8]}
                position={[
                  Math.cos(angle) * radius,
                  -0.1,
                  Math.sin(angle) * radius
                ]}
              >
                <meshStandardMaterial
                  color="#fbbf24"
                  emissive="#fbbf24"
                  emissiveIntensity={0.4}
                  opacity={0.6}
                  transparent
                />
              </Sphere>
            );
          })}
        </>
      )}
      
      {/* V6: Main beam cone - starts at face (y=0) with face radius, diverges downward */}
      <Cone
        args={[coneBottomRadius, coneHeight, 32]}
        position={[0, -coneHeight / 2, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <meshStandardMaterial
          color={coupling === "poor" ? "#f59e0b" : "#3b82f6"}
          emissive={coupling === "poor" ? "#f59e0b" : "#3b82f6"}
          emissiveIntensity={emissiveIntensity}
          opacity={opacity}
          transparent
          depthWrite={false}
          roughness={0.1}
          metalness={0.0}
        />
      </Cone>
      
      {/* V6: Beam origin indicator - shows where beam starts (at face) */}
      {coneTopRadius > 0 && (
        <Cone
          args={[coneTopRadius, 0.1, 32]}
          position={[0, 0, 0]}
          rotation={[Math.PI, 0, 0]}
        >
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={emissiveIntensity * 1.5}
            opacity={opacity * 1.2}
            transparent
            depthWrite={false}
          />
        </Cone>
      )}
      
      {/* Near field indicator (if applicable) */}
      {effectiveDepth < nearFieldLength && coneTopRadius > 0 && (
        <Cone
          args={[coneTopRadius * 0.95, Math.max(0.1, Math.min(effectiveDepth, nearFieldLength)), 32]}
          position={[0, -Math.max(0.05, Math.min(effectiveDepth, nearFieldLength) / 2), 0]}
          rotation={[Math.PI, 0, 0]}
        >
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#60a5fa"
            emissiveIntensity={emissiveIntensity * 1.2}
            opacity={opacity * 0.8}
            transparent
            depthWrite={false}
          />
        </Cone>
      )}
      
      {/* Penetration depth indicator - attenuated beam */}
      {penetrationDepth > 0 && coneBottomRadius > 0 && (
        <Cone
          args={[coneBottomRadius * 1.3, Math.max(0.1, penetrationDepth), 32]}
          position={[0, -Math.max(0.05, penetrationDepth / 2), 0]}
          rotation={[Math.PI, 0, 0]}
        >
          <meshStandardMaterial
            color="#06b6d4"
            emissive="#06b6d4"
            emissiveIntensity={emissiveIntensity * 0.2}
            opacity={opacity * 0.15}
            transparent
            depthWrite={false}
          />
        </Cone>
      )}
    </group>
  );
}
