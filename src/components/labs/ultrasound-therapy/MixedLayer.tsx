/**
 * MixedLayer - Visualiza camada mista (osso/músculo no mesmo plano)
 */

import { useMemo } from 'react';
import { Box } from '@react-three/drei';

interface MixedLayerProps {
  depth: number;
  division: number; // 0-100% (0 = all muscle, 100 = all bone)
  thickness: number;
}

export function MixedLayer({ depth, division, thickness }: MixedLayerProps) {
  const yPos = -depth - thickness / 2;
  const width = 20;
  
  // Calculate boundary position (division % from left)
  const boundaryX = (division / 100) * width - width / 2;
  
  // Left side: muscle, Right side: bone
  const muscleWidth = boundaryX + width / 2;
  const boneWidth = width / 2 - boundaryX;
  
  return (
    <group>
      {/* Muscle side (left) */}
      {muscleWidth > 0.1 && (
        <Box 
          args={[muscleWidth, thickness, 8]} 
          position={[-width / 2 + muscleWidth / 2, yPos, 0]}
        >
          <meshStandardMaterial 
            color="#c54545"
            opacity={0.7}
            transparent
            roughness={0.6}
            metalness={0.2}
            emissive="#441111"
            emissiveIntensity={0.1}
          />
        </Box>
      )}
      
      {/* Bone side (right) */}
      {boneWidth > 0.1 && (
        <Box 
          args={[boneWidth, thickness, 8]} 
          position={[width / 2 - boneWidth / 2, yPos, 0]}
        >
          <meshStandardMaterial 
            color="#f0f0f0"
            opacity={0.35}
            transparent
            roughness={0.3}
            metalness={0.1}
          />
        </Box>
      )}
      
      {/* Boundary line */}
      <Box args={[0.1, thickness, 8.1]} position={[boundaryX, yPos, 0]}>
        <meshStandardMaterial 
          color="#ffffff"
          opacity={0.8}
          transparent
          emissive="#ffffff"
          emissiveIntensity={0.3}
        />
      </Box>
    </group>
  );
}
