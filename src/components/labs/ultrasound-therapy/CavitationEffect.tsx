/**
 * CavitationEffect - Visualiza efeito de cavitação (lúdico e didático)
 */

import { useMemo, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group } from 'three';

interface CavitationEffectProps {
  intensity: number;
  mode: "continuous" | "pulsed";
  dutyCycle: number;
  frequency: number;
}

export function CavitationEffect({ 
  intensity, 
  mode, 
  dutyCycle,
  frequency 
}: CavitationEffectProps) {
  const groupRef = useRef<Group>(null);
  
  // Cavitation occurs with high intensity + pulsed mode
  const shouldShow = useMemo(() => {
    return intensity > 1.5 && mode === "pulsed" && frequency > 1.5;
  }, [intensity, mode, frequency]);
  
  // Generate micro-bubbles
  const bubbles = useMemo(() => {
    if (!shouldShow) return [];
    
    const count = Math.floor(intensity * 8); // More bubbles with higher intensity
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      initialX: (Math.random() - 0.5) * 2,
      initialZ: (Math.random() - 0.5) * 2,
      initialY: -0.5 - Math.random() * 2,
      size: 0.05 + Math.random() * 0.08,
      speed: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [shouldShow, intensity]);
  
  useFrame(({ clock }) => {
    if (!groupRef.current || !shouldShow) return;
    
    const time = clock.getElapsedTime();
    
    // Animate bubbles - they rise and collapse
    bubbles.forEach((bubble, i) => {
      const child = groupRef.current?.children[i] as Mesh;
      if (!child) return;
      
      // Pulsing effect based on duty cycle
      const period = 1.0;
      const onTime = period * (dutyCycle / 100);
      const cyclePos = ((time + bubble.phase) % period) / period;
      const isActive = cyclePos < (onTime / period);
      
      // Bubble rises and oscillates
      const yPos = bubble.initialY + Math.sin(time * bubble.speed + bubble.phase) * 0.3;
      const xPos = bubble.initialX + Math.cos(time * bubble.speed * 0.7 + bubble.phase) * 0.2;
      const zPos = bubble.initialZ + Math.sin(time * bubble.speed * 0.5 + bubble.phase) * 0.2;
      
      child.position.set(xPos, yPos, zPos);
      
      // Collapse animation when pulse is off
      const scale = isActive ? 1.0 : 0.3;
      child.scale.set(scale, scale, scale);
      
      // Material opacity
      if (child.material) {
        (child.material as any).opacity = isActive ? 0.7 : 0.2;
      }
    });
  });
  
  if (!shouldShow) return null;
  
  return (
    <group ref={groupRef}>
      {bubbles.map((bubble) => (
        <Sphere
          key={bubble.id}
          args={[bubble.size, 8, 8]}
          position={[bubble.initialX, bubble.initialY, bubble.initialZ]}
        >
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#3b82f6"
            emissiveIntensity={0.5}
            opacity={0.7}
            transparent
            roughness={0.1}
            metalness={0.3}
          />
        </Sphere>
      ))}
    </group>
  );
}
