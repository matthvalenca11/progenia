import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TissueConfig } from '@/types/tissueConfig';

type VisualizationMode = 'anatomical' | 'electric' | 'lesion';

interface TissueLayersModelProps {
  tissueConfig: TissueConfig;
  visualMode: VisualizationMode;
  intensityNorm: number;
  lesionIndex?: number;
}

export function TissueLayersModel({
  tissueConfig,
  visualMode,
  intensityNorm,
  lesionIndex = 0,
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
    
    // Skin base color - com eritema se houver lesão
    const baseR = 250;
    const baseG = 212 - Math.floor(lesionIndex * 100); // Mais vermelho com lesão
    const baseB = 192 - Math.floor(lesionIndex * 120);
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add subtle noise for skin texture
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 2;
      const opacity = Math.random() * 0.3;
      ctx.fillStyle = `rgba(255, ${220 - lesionIndex * 100}, 200, ${opacity})`;
      ctx.fillRect(x, y, size, size);
    }
    
    // LESION: Adicionar manchas de eritema se lesionIndex > 0.3
    if (lesionIndex > 0.3) {
      const numSpots = Math.floor(lesionIndex * 20);
      for (let i = 0; i < numSpots; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 10 + Math.random() * 30;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const intensity = lesionIndex * 0.8;
        gradient.addColorStop(0, `rgba(255, 50, 50, ${intensity})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 100, ${intensity * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 150, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }, [lesionIndex]);

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
    
    // Muscle base color - mais escuro com lesão profunda
    const baseR = 197 + Math.floor(lesionIndex * 40);
    const baseG = 69 - Math.floor(lesionIndex * 30);
    const baseB = 69 - Math.floor(lesionIndex * 30);
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add fiber pattern - mais desorganizado com lesão
    const disorganization = lesionIndex * 30;
    ctx.strokeStyle = `rgba(139, 0, 0, ${0.3 + lesionIndex * 0.3})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 50; i++) {
      const y = (i * 512) / 50;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y + Math.random() * (20 + disorganization) - (10 + disorganization / 2));
      ctx.stroke();
    }
    
    // Add muscle bundles
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(180, 50, 50, ${Math.random() * 0.3})`;
      ctx.fillRect(x, y, 2, 10 + Math.random() * 20);
    }
    
    // LESION: Adicionar áreas de dano muscular se lesionIndex > 0.5
    if (lesionIndex > 0.5) {
      const numDamageAreas = Math.floor((lesionIndex - 0.5) * 15);
      for (let i = 0; i < numDamageAreas; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 15 + Math.random() * 40;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const intensity = (lesionIndex - 0.5) * 1.5;
        gradient.addColorStop(0, `rgba(100, 0, 0, ${intensity})`);
        gradient.addColorStop(0.5, `rgba(150, 20, 20, ${intensity * 0.6})`);
        gradient.addColorStop(1, 'rgba(197, 69, 69, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Adicionar "rasgos" nas fibras para simular ruptura
      const tearIntensity = (lesionIndex - 0.5) * 1.5;
      ctx.strokeStyle = `rgba(80, 0, 0, ${tearIntensity})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 20; i++) {
        const startX = Math.random() * 512;
        const startY = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + (Math.random() - 0.5) * 60, startY + Math.random() * 40);
        ctx.stroke();
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  }, [lesionIndex]);

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
    
    // LESION: Adicionar emissão quando há lesão
    if (visualMode === 'lesion' && lesionIndex > 0.4) {
      if (layer === 'skin' && lesionIndex > 0.3) {
        return new THREE.Color('#ff3333').multiplyScalar((lesionIndex - 0.3) * 0.5);
      }
      if (layer === 'muscle' && lesionIndex > 0.5) {
        return new THREE.Color('#990000').multiplyScalar((lesionIndex - 0.5) * 0.8);
      }
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
