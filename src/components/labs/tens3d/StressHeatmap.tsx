import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TissueConfig, RiskResult } from '@/types/tissueConfig';

interface StressHeatmapProps {
  electrodePositions: {
    proximal: [number, number, number];
    distal: [number, number, number];
  };
  intensityNorm: number;
  pulseNorm: number;
  tissueConfig: TissueConfig;
  riskResult: RiskResult;
}

export function StressHeatmap({
  electrodePositions,
  intensityNorm,
  pulseNorm,
  tissueConfig,
  riskResult,
}: StressHeatmapProps) {
  const heatmapRef = useRef<THREE.Mesh>(null);

  // Generate procedural heatmap texture
  const heatmapTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Calculate hotspot intensity
    const thermalLoad = intensityNorm * 0.5 + pulseNorm * 0.3;
    const riskScore = riskResult.riskScore / 100;

    // Add hotspots based on risk factors
    const hotspots: { x: number; y: number; intensity: number; size: number }[] = [];

    // High intensity hotspots
    if (intensityNorm > 0.6) {
      hotspots.push(
        { x: 256, y: 100, intensity: intensityNorm, size: 60 + intensityNorm * 40 },
        { x: 150, y: 200, intensity: intensityNorm * 0.7, size: 50 },
        { x: 362, y: 200, intensity: intensityNorm * 0.7, size: 50 }
      );
    }

    // Metal implant hotspot
    if (tissueConfig.hasMetalImplant) {
      const implantDepth = (tissueConfig.metalImplantDepth || 20) / 100;
      hotspots.push({
        x: 256,
        y: 100 + implantDepth * 300,
        intensity: 1.0,
        size: 80,
      });
    }

    // Superficial bone hotspots
    if (tissueConfig.boneDepth < 30) {
      hotspots.push(
        { x: 180, y: 400, intensity: riskScore * 0.8, size: 70 },
        { x: 332, y: 400, intensity: riskScore * 0.8, size: 70 }
      );
    }

    // Thin skin risk
    if (tissueConfig.skinThickness < 2) {
      hotspots.push(
        { x: 256, y: 50, intensity: intensityNorm * 0.9, size: 100 },
        { x: 128, y: 80, intensity: intensityNorm * 0.6, size: 60 },
        { x: 384, y: 80, intensity: intensityNorm * 0.6, size: 60 }
      );
    }

    // Draw hotspots with irregular patterns
    hotspots.forEach((hotspot) => {
      // Main hotspot
      const gradient = ctx.createRadialGradient(
        hotspot.x,
        hotspot.y,
        0,
        hotspot.x,
        hotspot.y,
        hotspot.size
      );
      
      if (hotspot.intensity > 0.7) {
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.9)');
        gradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
      } else if (hotspot.intensity > 0.4) {
        gradient.addColorStop(0, 'rgba(255, 150, 0, 0.7)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 0, 0.5)');
        gradient.addColorStop(0.7, 'rgba(200, 255, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(100, 255, 0, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(hotspot.x, hotspot.y, hotspot.size, 0, Math.PI * 2);
      ctx.fill();

      // Add irregular dendritic patterns around high-risk hotspots
      if (hotspot.intensity > 0.7) {
        ctx.strokeStyle = `rgba(255, 0, 0, ${hotspot.intensity * 0.5})`;
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const length = hotspot.size * (0.8 + Math.random() * 0.6);
          const endX = hotspot.x + Math.cos(angle) * length;
          const endY = hotspot.y + Math.sin(angle) * length;
          
          ctx.beginPath();
          ctx.moveTo(hotspot.x, hotspot.y);
          
          // Create jagged dendritic branch
          const segments = 5;
          for (let j = 1; j <= segments; j++) {
            const t = j / segments;
            const x = hotspot.x + (endX - hotspot.x) * t + (Math.random() - 0.5) * 10;
            const y = hotspot.y + (endY - hotspot.y) * t + (Math.random() - 0.5) * 10;
            ctx.lineTo(x, y);
          }
          
          ctx.stroke();
        }
      }
    });

    // Add noise for tissue stress irregularity
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 100 || data[i + 1] > 100) {
        const noise = (Math.random() - 0.5) * 30 * riskScore;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
    }
    
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [intensityNorm, pulseNorm, tissueConfig, riskResult]);

  // Pulsing animation for high-risk areas
  useFrame((state) => {
    if (!heatmapRef.current) return;
    
    if (riskResult.riskScore > 50) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 0.9;
      const material = heatmapRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.6 * pulse;
    }
  });

  const centerX = (electrodePositions.proximal[0] + electrodePositions.distal[0]) / 2;
  const width = Math.abs(electrodePositions.distal[0] - electrodePositions.proximal[0]) + 2;

  return (
    <mesh ref={heatmapRef} position={[centerX, -1.5, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, 5]} />
      <meshBasicMaterial
        map={heatmapTexture}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
