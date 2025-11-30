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

  // Calculate lesion index
  const lesionIndex = useMemo(() => {
    let index = 0;
    
    // Base risk from riskResult
    if (riskResult.riskLevel === "alto") index += 0.7;
    else if (riskResult.riskLevel === "moderado") index += 0.4;
    
    // Intensity contribution
    index += intensityNorm * 0.3;
    
    // Pulse width contribution
    index += pulseNorm * 0.3;
    
    // Metal implant increases lesion risk dramatically
    if (tissueConfig.hasMetalImplant && intensityNorm > 0.5) {
      index += 0.4;
    }
    
    // Superficial bone with high intensity
    if (tissueConfig.boneDepth < 0.4 && intensityNorm > 0.6) {
      index += 0.3;
    }
    
    // Thin skin increases surface lesion risk
    if (tissueConfig.skinThickness < 0.2 && intensityNorm > 0.5) {
      index += 0.25;
    }
    
    return Math.min(1, Math.max(0, index));
  }, [intensityNorm, pulseNorm, tissueConfig, riskResult]);

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

    // Calculate hotspot intensity using lesion index
    const riskScore = riskResult.riskScore / 100;

    // Add hotspots based on risk factors and lesion index
    const hotspots: { x: number; y: number; intensity: number; size: number }[] = [];

    // LESION: Eritema superficial (skin damage) - aparece a partir de lesionIndex > 0.3
    if (lesionIndex > 0.3) {
      const erythemaIntensity = Math.min(1, (lesionIndex - 0.3) / 0.4); // 0.3-0.7 -> 0-1
      hotspots.push(
        { x: 256, y: 80, intensity: erythemaIntensity, size: 120 + erythemaIntensity * 60 },
        { x: 180, y: 120, intensity: erythemaIntensity * 0.8, size: 80 },
        { x: 332, y: 120, intensity: erythemaIntensity * 0.8, size: 80 }
      );
    }

    // LESION: Dano muscular profundo - aparece com lesionIndex > 0.5
    if (lesionIndex > 0.5) {
      const muscleIntensity = Math.min(1, (lesionIndex - 0.5) / 0.3); // 0.5-0.8 -> 0-1
      hotspots.push(
        { x: 256, y: 250, intensity: muscleIntensity, size: 90 + muscleIntensity * 50 },
        { x: 200, y: 300, intensity: muscleIntensity * 0.9, size: 70 },
        { x: 312, y: 300, intensity: muscleIntensity * 0.9, size: 70 }
      );
    }

    // LESION: Metal implant hotspot - intenso quando há risco
    if (tissueConfig.hasMetalImplant && lesionIndex > 0.4) {
      const implantDepth = (tissueConfig.metalImplantDepth || 0.5);
      const implantIntensity = Math.min(1.2, lesionIndex * 1.5); // Pode exceder 1.0 para brilho extra
      hotspots.push({
        x: 256,
        y: 100 + implantDepth * 300,
        intensity: implantIntensity,
        size: 100 + implantIntensity * 40,
      });
      
      // Adicionar halos ao redor do implante
      hotspots.push(
        { x: 220, y: 100 + implantDepth * 300, intensity: implantIntensity * 0.7, size: 60 },
        { x: 292, y: 100 + implantDepth * 300, intensity: implantIntensity * 0.7, size: 60 }
      );
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
      
      // LESION COLORS: mais intenso e realista
      if (hotspot.intensity > 0.8) {
        // Lesão severa - quase branco no centro (necrose)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.2, 'rgba(255, 100, 100, 0.95)');
        gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(150, 0, 0, 0)');
      } else if (hotspot.intensity > 0.6) {
        // Lesão moderada-alta - vermelho intenso
        gradient.addColorStop(0, 'rgba(255, 50, 50, 0.95)');
        gradient.addColorStop(0.4, 'rgba(255, 80, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
      } else if (hotspot.intensity > 0.4) {
        // Lesão moderada - laranja/amarelo
        gradient.addColorStop(0, 'rgba(255, 150, 0, 0.7)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      } else {
        // Lesão leve - amarelo esverdeado
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
  }, [intensityNorm, pulseNorm, tissueConfig, riskResult, lesionIndex]);

  // Pulsing animation for high-risk areas - mais intenso com lesionIndex
  useFrame((state) => {
    if (!heatmapRef.current) return;
    
    if (lesionIndex > 0.5) {
      // Pulso mais rápido e intenso para lesões
      const pulseSpeed = 3 + lesionIndex * 3;
      const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.15 + 0.85;
      const material = heatmapRef.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = 0.6 + lesionIndex * 0.2; // Aumenta opacidade base com lesão
      material.opacity = baseOpacity * pulse;
    } else if (riskResult.riskScore > 30) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.9;
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
