/**
 * TransducerModel - Visualiza o transdutor de ultrassom (V4: Didático e Realista)
 */

import { useMemo, useRef } from 'react';
import { Cylinder, Sphere, Ring } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface TransducerModelProps {
  era: number;
  coupling?: "good" | "poor";
  mode?: "continuous" | "pulsed";
  intensity?: number;
  dutyCycle?: number;
  position?: { x: number; y: number }; // V5: 2D position control
}

export function TransducerModel({ 
  era, 
  coupling = "good",
  mode = "continuous",
  intensity = 1.0,
  dutyCycle = 50,
  position = { x: 0, y: 0 }
}: TransducerModelProps) {
  // V6: Face radius directly from ERA (geometrically correct)
  const faceRadius = useMemo(() => Math.sqrt(era / Math.PI), [era]);
  
  // Handle dimensions (independent of ERA, but proportional)
  const handleRadius = Math.max(0.3, faceRadius * 0.4); // Handle is smaller than face
  const handleHeight = 0.8; // Fixed handle height
  const bodyHeight = 0.15; // Small body section
  
  // V5: Position offset (scale to volume size: 20 units wide, 8 units deep)
  const xOffset = position.x * 8; // Scale to half-width
  const zOffset = position.y * 3; // Scale to half-depth
  
  // Face position: at surface (y = 0)
  const faceY = 0;
  
  // Refs for animation
  const faceRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  
  // Animation for pulsing/halo effect
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    if (faceRef.current) {
      if (mode === "continuous") {
        // Continuous: steady glow with subtle pulse
        const pulse = 0.1 + Math.sin(time * 2) * 0.05;
        faceRef.current.material.emissiveIntensity = 0.15 + pulse * intensity;
      } else {
        // Pulsed: on/off pattern based on duty cycle
        const period = 1.0; // 1 second period
        const onTime = period * (dutyCycle / 100);
        const cyclePos = (time % period) / period;
        const isOn = cyclePos < (onTime / period);
        faceRef.current.material.emissiveIntensity = isOn ? 0.3 * intensity : 0.05;
      }
    }
    
    if (haloRef.current) {
      if (mode === "continuous") {
        // Continuous: expanding/contracting halo
        const scale = 1.0 + Math.sin(time * 3) * 0.15;
        haloRef.current.scale.set(scale, scale, 1);
        haloRef.current.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
      } else {
        // Pulsed: flash on pulse
        const period = 1.0;
        const onTime = period * (dutyCycle / 100);
        const cyclePos = (time % period) / period;
        const isOn = cyclePos < (onTime / period);
        haloRef.current.scale.set(isOn ? 1.2 : 1.0, isOn ? 1.2 : 1.0, 1);
        haloRef.current.material.opacity = isOn ? 0.3 : 0.05;
      }
    }
    
    if (pulseRef.current && mode === "pulsed") {
      // Pulsing ring for pulsed mode
      const period = 1.0;
      const onTime = period * (dutyCycle / 100);
      const cyclePos = (time % period) / period;
      const isOn = cyclePos < (onTime / period);
      pulseRef.current.material.opacity = isOn ? 0.6 : 0.1;
    }
  });
  
  const intensityNorm = Math.min(1, intensity / 2.5);
  
  return (
    <group position={[xOffset, 0, zOffset]}>
      {/* V6: Transducer handle (above face, doesn't cover it) */}
      {/* Handle grip section */}
      <Cylinder 
        args={[handleRadius, handleRadius, handleHeight, 16]} 
        position={[0, bodyHeight + handleHeight / 2, 0]}
      >
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.7}
          metalness={0.1}
        />
      </Cylinder>
      
      {/* Handle transition to body */}
      <Cylinder 
        args={[handleRadius * 1.2, handleRadius, bodyHeight * 0.5, 16]} 
        position={[0, bodyHeight, 0]}
      >
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.5}
          metalness={0.3}
        />
      </Cylinder>
      
      {/* Transducer body (small section above face) */}
      <Cylinder 
        args={[faceRadius * 1.1, faceRadius * 1.05, bodyHeight, 32]} 
        position={[0, bodyHeight / 2, 0]}
      >
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.4}
          metalness={0.7}
        />
      </Cylinder>
      
      {/* V6: Active face - PLANE CIRCULAR (geometrically correct) */}
      {/* Face is a very thin disc at y=0 (surface) - using thin cylinder */}
      <Cylinder 
        ref={faceRef} 
        args={[faceRadius, faceRadius, 0.02, 32]} 
        position={[0, faceY, 0]} 
      >
        <meshStandardMaterial
          color="#1e40af"
          roughness={0.1}
          metalness={0.9}
          emissive="#3b82f6"
          emissiveIntensity={0.15}
        />
      </Cylinder>
      
      {/* Halo effect - visual feedback (ring around face) */}
      <Ring 
        ref={haloRef} 
        args={[faceRadius * 1.02, faceRadius * 1.08, 32]} 
        position={[0, faceY + 0.01, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color={mode === "continuous" ? "#3b82f6" : "#fbbf24"}
          emissive={mode === "continuous" ? "#3b82f6" : "#fbbf24"}
          emissiveIntensity={0.3}
          opacity={0.2}
          transparent
        />
      </Ring>
      
      {/* Pulsing ring for pulsed mode */}
      {mode === "pulsed" && (
        <Ring 
          ref={pulseRef} 
          args={[faceRadius * 0.95, faceRadius * 1.0, 32]} 
          position={[0, faceY + 0.01, 0]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.5}
            opacity={0.6}
            transparent
          />
        </Ring>
      )}
      
      {/* V6: Coupling gel - same size as face, between face and skin */}
      {coupling === "good" && (
        <Cylinder 
          args={[faceRadius, faceRadius, 0.1, 32]} 
          position={[0, faceY - 0.05, 0]}
        >
          <meshStandardMaterial
            color="#60a5fa"
            opacity={0.5}
            transparent
            roughness={0.1}
            metalness={0.0}
          />
        </Cylinder>
      )}
      
      {/* Poor coupling indicator (air bubbles/scattering) */}
      {coupling === "poor" && (
        <group>
          <Cylinder 
            args={[faceRadius, faceRadius, 0.08, 32]} 
            position={[0, faceY - 0.04, 0]}
          >
            <meshStandardMaterial
              color="#fbbf24"
              opacity={0.3}
              transparent
              roughness={0.5}
              metalness={0.0}
            />
          </Cylinder>
          {/* Air bubbles - positioned relative to face radius */}
          {[
            { x: -0.3, z: 0.2 },
            { x: 0.2, z: -0.3 },
            { x: 0.1, z: 0.3 }
          ].map((pos, i) => (
            <Sphere
              key={i}
              args={[0.08, 8, 8]}
              position={[
                pos.x * faceRadius * 0.6,
                faceY - 0.04,
                pos.z * faceRadius * 0.6
              ]}
            >
              <meshStandardMaterial
                color="#ffffff"
                opacity={0.6}
                transparent
              />
            </Sphere>
          ))}
        </group>
      )}
    </group>
  );
}
