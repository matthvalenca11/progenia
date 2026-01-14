/**
 * TemperatureHeatmap - Visualiza mapa de temperatura
 */

import { useMemo, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface TemperatureHeatmapProps {
  maxTemp: number;
  maxTempDepth: number;
  surfaceTemp: number;
  targetTemp: number;
  movement?: "stationary" | "scanning";
  treatedArea?: number;
  position?: { x: number; y: number }; // V5: 2D position
  era?: number; // V6: ERA for correct scaling
}

export function TemperatureHeatmap({ 
  maxTemp, 
  maxTempDepth, 
  surfaceTemp, 
  targetTemp,
  movement = "stationary",
  treatedArea = 0,
  position = { x: 0, y: 0 },
  era = 5.0
}: TemperatureHeatmapProps) {
  const tempNorm = useMemo(() => {
    // Normalize temperature (37-50°C range, clamped)
    const clampedTemp = Math.min(50, Math.max(37, maxTemp));
    return Math.min(1, Math.max(0, (clampedTemp - 37) / 13));
  }, [maxTemp]);

  const surfaceTempNorm = useMemo(() => {
    const clampedTemp = Math.min(50, Math.max(37, surfaceTemp));
    return Math.min(1, Math.max(0, (clampedTemp - 37) / 13));
  }, [surfaceTemp]);

  const targetTempNorm = useMemo(() => {
    const clampedTemp = Math.min(50, Math.max(37, targetTemp));
    return Math.min(1, Math.max(0, (clampedTemp - 37) / 13));
  }, [targetTemp]);

  // Color gradient: blue (37°C) -> green (40°C) -> yellow (43°C) -> orange (46°C) -> red (50°C)
  const getColor = (tempNorm: number) => {
    if (tempNorm < 0.23) {
      // Blue to green (37-40°C)
      const t = tempNorm / 0.23;
      return `rgb(${Math.floor(59 + t * 50)}, ${Math.floor(130 + t * 125)}, ${Math.floor(246 - t * 146)})`;
    } else if (tempNorm < 0.46) {
      // Green to yellow (40-43°C)
      const t = (tempNorm - 0.23) / 0.23;
      return `rgb(${Math.floor(109 + t * 146)}, ${Math.floor(255)}, ${Math.floor(100 - t * 100)})`;
    } else if (tempNorm < 0.69) {
      // Yellow to orange (43-46°C)
      const t = (tempNorm - 0.46) / 0.23;
      return `rgb(${Math.floor(255)}, ${Math.floor(255 - t * 100)}, 0)`;
    } else {
      // Orange to red (46-50°C)
      const t = (tempNorm - 0.69) / 0.31;
      return `rgb(${Math.floor(255)}, ${Math.floor(155 - t * 155)}, 0)`;
    }
  };

  // V6: Hotspot size scales with ERA (geometrically correct)
  const faceRadius = useMemo(() => Math.sqrt(era / Math.PI), [era]);
  const baseHotspotSize = faceRadius * 0.8; // Hotspot scales with face size
  
  // Calculate hotspot size based on movement
  const hotspotSize = movement === "scanning" ? baseHotspotSize * 1.5 : baseHotspotSize; // Larger but less intense when scanning
  const hotspotIntensity = movement === "scanning" ? 0.8 : 1.5; // Less intense when scanning
  
  // Scanning creates a wider, more distributed heat pattern
  const scanningRadius = movement === "scanning" ? Math.sqrt(treatedArea / Math.PI) * 0.3 : 0; // Convert area to radius (scaled)
  
  // Refs for heat diffusion animation
  const surfaceHotspotRef = useRef<Mesh>(null);
  const maxHotspotRef = useRef<Mesh>(null);
  const gradientRef = useRef<Mesh>(null);
  
  // Animate heat diffusion (lúdico)
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pulse = 0.95 + Math.sin(time * 1.5) * 0.05; // Subtle pulsing
    
    if (surfaceHotspotRef.current && surfaceTempNorm > 0.15) {
      surfaceHotspotRef.current.scale.set(pulse, pulse, pulse);
    }
    
    if (maxHotspotRef.current && tempNorm > 0.15) {
      maxHotspotRef.current.scale.set(pulse, pulse, pulse);
    }
    
    if (gradientRef.current && tempNorm > 0.2) {
      const expand = 1.0 + Math.sin(time * 0.8) * 0.1; // Heat diffusion
      gradientRef.current.scale.set(expand, expand, expand);
    }
  });

  // V6: Position offset - heatmap starts at surface (y=0)
  const xOffset = position.x * 8;
  const zOffset = position.y * 3;
  
  return (
    <group position={[xOffset, 0, zOffset]}>
      {/* Surface hotspot - clearly separated from target - V4: Animated */}
      {surfaceTempNorm > 0.15 && (
        <Sphere ref={surfaceHotspotRef} args={[0.5, 16, 16]} position={[0, -0.05, 0]}>
          <meshStandardMaterial
            color={getColor(surfaceTempNorm)}
            emissive={getColor(surfaceTempNorm)}
            emissiveIntensity={surfaceTempNorm * 1.4}
            opacity={0.8}
            transparent
            roughness={0.2}
            metalness={0.1}
          />
        </Sphere>
      )}
      
      {/* Maximum temperature hotspot - main focus - V4: Animated */}
      {tempNorm > 0.15 && (
        <>
          <Sphere ref={maxHotspotRef} args={[hotspotSize, 32, 32]} position={[0, -maxTempDepth, 0]}>
            <meshStandardMaterial
              color={getColor(tempNorm)}
              emissive={getColor(tempNorm)}
              emissiveIntensity={tempNorm * hotspotIntensity * 1.2}
              opacity={movement === "scanning" ? 0.7 : 0.9}
              transparent
              roughness={0.1}
              metalness={0.2}
            />
          </Sphere>
          
          {/* Scanning pattern - shows distributed area */}
          {movement === "scanning" && scanningRadius > 0 && (
            <Sphere args={[scanningRadius, 16, 16]} position={[0, -maxTempDepth * 0.7, 0]}>
              <meshStandardMaterial
                color={getColor(tempNorm * 0.4)}
                emissive={getColor(tempNorm * 0.4)}
                emissiveIntensity={tempNorm * 0.2}
                opacity={0.2}
                transparent
              />
            </Sphere>
          )}
        </>
      )}
      
      {/* Thermal gradient volume - shows heat distribution - V4: Animated diffusion */}
      {tempNorm > 0.2 && (
        <Sphere ref={gradientRef} args={[1.5, 16, 16]} position={[0, -maxTempDepth, 0]}>
          <meshStandardMaterial
            color={getColor(tempNorm * 0.6)}
            emissive={getColor(tempNorm * 0.6)}
            emissiveIntensity={tempNorm * 0.4}
            opacity={0.25}
            transparent
          />
        </Sphere>
      )}
      
      {/* Target temperature zone - at effective depth, clearly different from surface */}
      {targetTempNorm > 0.15 && maxTempDepth > 0.5 && (
        <Sphere args={[0.8, 16, 16]} position={[0, -maxTempDepth, 0]}>
          <meshStandardMaterial
            color={getColor(targetTempNorm)}
            emissive={getColor(targetTempNorm)}
            emissiveIntensity={targetTempNorm * 0.6}
            opacity={0.5}
            transparent
            roughness={0.3}
            metalness={0.1}
          />
        </Sphere>
      )}
    </group>
  );
}
