import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TissueConfig } from '@/types/tissueConfig';

type VisualizationMode = 'anatomical' | 'electric' | 'lesion';

interface TissueLayersModelProps {
  tissueConfig: TissueConfig;
  visualMode: VisualizationMode;
  intensityNorm: number;
}

export function TissueLayersModel({
  tissueConfig,
  visualMode,
  intensityNorm,
}: TissueLayersModelProps) {
  // Calculate layer dimensions
  const totalThickness = 
    tissueConfig.skinThickness + 
    tissueConfig.fatThickness + 
    tissueConfig.muscleThickness;
  
  const skinHeight = tissueConfig.skinThickness / 10;
  const fatHeight = tissueConfig.fatThickness / 10;
  const muscleHeight = tissueConfig.muscleThickness / 10;
  const boneHeight = 0.5;

  // Calculate Y positions (stacking from top)
  let currentY = 0;
  const skinY = currentY - skinHeight / 2;
  currentY -= skinHeight;
  const fatY = currentY - fatHeight / 2;
  currentY -= fatHeight;
  const muscleY = currentY - muscleHeight / 2;
  currentY -= muscleHeight;
  const boneY = currentY - boneHeight / 2;

  // Create procedural textures
  const skinTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Skin base color
    ctx.fillStyle = '#fad4c0';
    ctx.fillRect(0, 0, 512, 512);
    
    // Add subtle noise for skin texture
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 2;
      ctx.fillStyle = `rgba(255, 220, 200, ${Math.random() * 0.3})`;
      ctx.fillRect(x, y, size, size);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }, []);

  const fatTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Fat base color
    ctx.fillStyle = '#ffe4b5';
    ctx.fillRect(0, 0, 512, 512);
    
    // Add nodular pattern
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = 10 + Math.random() * 20;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255, 240, 180, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 228, 181, 0.2)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1.5);
    return texture;
  }, []);

  const muscleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Muscle base color
    ctx.fillStyle = '#c54545';
    ctx.fillRect(0, 0, 512, 512);
    
    // Add fiber pattern
    ctx.strokeStyle = 'rgba(139, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 50; i++) {
      const y = (i * 512) / 50;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y + Math.random() * 20 - 10);
      ctx.stroke();
    }
    
    // Add muscle bundles
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(180, 50, 50, ${Math.random() * 0.3})`;
      ctx.fillRect(x, y, 2, 10 + Math.random() * 20);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  }, []);

  const boneTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Bone base color
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 512, 512);
    
    // Add cortical bone texture
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(200, 200, 200, ${Math.random() * 0.5})`;
      ctx.fillRect(x, y, 1, 1);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }, []);

  // Adjust opacity and appearance based on visualization mode
  const getLayerOpacity = (layer: string) => {
    if (visualMode === 'anatomical') return 1.0;
    if (visualMode === 'electric') {
      // Make tissues semi-transparent to see field
      if (layer === 'skin') return 0.7;
      if (layer === 'fat') return 0.6;
      if (layer === 'muscle') return 0.8;
      if (layer === 'bone') return 0.9;
    }
    if (visualMode === 'lesion') {
      // Even more transparent to see heatmap
      if (layer === 'skin') return 0.5;
      if (layer === 'fat') return 0.4;
      if (layer === 'muscle') return 0.6;
      if (layer === 'bone') return 0.7;
    }
    return 1.0;
  };

  const getLayerEmissive = (layer: string) => {
    if (visualMode === 'electric' && intensityNorm > 0.3) {
      // Add slight glow when field is active
      if (layer === 'muscle') return new THREE.Color('#441111').multiplyScalar(intensityNorm * 0.3);
    }
    return new THREE.Color('#000000');
  };

  return (
    <group>
      {/* Skin Layer */}
      <mesh position={[0, skinY, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, skinHeight, 8]} />
        <meshStandardMaterial
          map={skinTexture}
          transparent
          opacity={getLayerOpacity('skin')}
          roughness={0.7}
          metalness={0.1}
          emissive={getLayerEmissive('skin')}
        />
      </mesh>

      {/* Fat Layer */}
      {tissueConfig.fatThickness > 0 && (
        <mesh position={[0, fatY, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, fatHeight, 8]} />
          <meshStandardMaterial
            map={fatTexture}
            transparent
            opacity={getLayerOpacity('fat')}
            roughness={0.8}
            metalness={0.0}
            emissive={getLayerEmissive('fat')}
          />
        </mesh>
      )}

      {/* Muscle Layer */}
      <mesh position={[0, muscleY, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, muscleHeight, 8]} />
        <meshStandardMaterial
          map={muscleTexture}
          transparent
          opacity={getLayerOpacity('muscle')}
          roughness={0.6}
          metalness={0.2}
          emissive={getLayerEmissive('muscle')}
        />
      </mesh>

      {/* Bone Layer */}
      <mesh position={[0, boneY, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, boneHeight, 8]} />
        <meshStandardMaterial
          map={boneTexture}
          transparent
          opacity={getLayerOpacity('bone')}
          roughness={0.3}
          metalness={0.4}
          emissive={getLayerEmissive('bone')}
        />
      </mesh>

      {/* Metal Implant (if present) */}
      {tissueConfig.hasMetalImplant && tissueConfig.metalImplantDepth !== null && (
        <mesh
          position={[
            0,
            skinY - (tissueConfig.metalImplantDepth / 10),
            0,
          ]}
          castShadow
        >
          <cylinderGeometry args={[0.3, 0.3, tissueConfig.metalImplantSpan || 2, 16]} />
          <meshStandardMaterial
            color="#8b9dc3"
            roughness={0.1}
            metalness={0.9}
            emissive={visualMode === 'electric' ? '#4488ff' : '#000000'}
            emissiveIntensity={visualMode === 'electric' ? intensityNorm * 0.5 : 0}
          />
        </mesh>
      )}

      {/* Layer Labels (when in anatomical mode) */}
      {visualMode === 'anatomical' && (
        <group>
          <LabelSprite text="Pele" position={[5.5, skinY, 0]} />
          {tissueConfig.fatThickness > 0 && (
            <LabelSprite text="Gordura" position={[5.5, fatY, 0]} />
          )}
          <LabelSprite text="Músculo" position={[5.5, muscleY, 0]} />
          <LabelSprite text="Osso" position={[5.5, boneY, 0]} />
          {tissueConfig.hasMetalImplant && (
            <LabelSprite
              text="Implante"
              position={[5.5, skinY - (tissueConfig.metalImplantDepth || 0) / 10, 0]}
            />
          )}
        </group>
      )}
    </group>
  );
}

// Helper component for text labels
function LabelSprite({ text, position }: { text: string; position: [number, number, number] }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, 256, 64);
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    
    return c;
  }, [text]);

  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  return (
    <sprite position={position} scale={[2, 0.5, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
}
