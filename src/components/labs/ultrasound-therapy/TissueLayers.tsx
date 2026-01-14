/**
 * TissueLayers - Renderiza camadas de tecido 3D
 * STACK MODEL: Empilhamento cumulativo onde cada camada empurra as camadas abaixo
 */

import { useMemo } from 'react';
import { Box, Text } from '@react-three/drei';
import { MeshStandardMaterial, DoubleSide } from 'three';
import { AnatomicalScenario } from '@/types/ultrasoundTherapyConfig';

// Paleta didática fixa
const TISSUE_COLORS = {
  skin: '#8B5A2B',      // Marrom
  fat: '#F2D16B',      // Amarelo
  muscle: '#E06A6A',   // Vermelho claro
  bone: '#D9D9D9',     // Cinza claro
};

const TISSUE_BORDER_COLORS = {
  skin: '#6B4423',
  fat: '#D4B85A',
  muscle: '#C85A5A',
  bone: '#B8B8B8',
};

// Profundidade total do bloco (fixa)
const TOTAL_BLOCK_DEPTH = 6.0; // cm

// Simple noise function for material variation
function noise(x: number, y: number): number {
  return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
}

interface TissueLayersProps {
  scenario: AnatomicalScenario;
  showLabels?: boolean;
  customThicknesses?: {
    skin: number;
    fat: number;
    muscle: number;
    boneThickness?: number; // Opcional: espessura do osso (se não definido, preenche o restante)
  };
  stopAtDepth?: number; // V5: Stop rendering at this depth (for mixed layer)
}

interface LayerDefinition {
  type: 'skin' | 'fat' | 'muscle' | 'bone';
  startDepth: number;  // Profundidade onde a camada começa (da superfície)
  endDepth: number;    // Profundidade onde a camada termina
  thickness: number;   // Espessura calculada
  color: string;
  borderColor: string;
}

export function TissueLayers({ scenario, showLabels = false, customThicknesses, stopAtDepth }: TissueLayersProps) {
  const layers = useMemo(() => {
    // Determinar espessuras baseado no cenário
    let skinThickness: number;
    let fatThickness: number;
    let muscleThickness: number;
    let boneThickness: number | undefined;

    if (scenario === "custom" && customThicknesses) {
      skinThickness = customThicknesses.skin || 0.2;
      fatThickness = customThicknesses.fat || 0.5;
      muscleThickness = customThicknesses.muscle || 2.0;
      boneThickness = customThicknesses.boneThickness; // Opcional
    } else {
      // Valores padrão por cenário
      switch (scenario) {
        case "shoulder":
          skinThickness = 0.2;
          fatThickness = 0.5;
          muscleThickness = 2.0;
          boneThickness = 1.0;
          break;
        case "knee":
          skinThickness = 0.2;
          fatThickness = 0.3;
          muscleThickness = 1.5;
          boneThickness = 1.0;
          break;
        case "lumbar":
          skinThickness = 0.2;
          fatThickness = 1.0;
          muscleThickness = 3.0;
          boneThickness = undefined; // Sem osso neste cenário
          break;
        case "forearm":
          skinThickness = 0.2;
          fatThickness = 0.2;
          muscleThickness = 1.0;
          boneThickness = undefined; // Sem osso neste cenário
          break;
        default:
          skinThickness = 0.2;
          fatThickness = 0.5;
          muscleThickness = 2.0;
          boneThickness = undefined;
      }
    }

    // ============================================
    // STACK MODEL: Cálculo cumulativo puro
    // ============================================
    const topZ = 0; // Superfície
    
    // Pele
    const skinStart = topZ;
    const skinEnd = skinStart + skinThickness;
    
    // Gordura (começa onde a pele termina)
    const fatStart = skinEnd;
    const fatEnd = fatStart + fatThickness;
    
    // Músculo (começa onde a gordura termina)
    const muscleStart = fatEnd;
    
    // Validação: se a soma excede o volume, clamp o músculo
    const maxMuscleEnd = boneThickness !== undefined 
      ? TOTAL_BLOCK_DEPTH - boneThickness 
      : TOTAL_BLOCK_DEPTH;
    const actualMuscleEnd = Math.min(muscleStart + muscleThickness, maxMuscleEnd);
    const actualMuscleThickness = Math.max(0, actualMuscleEnd - muscleStart);
    
    // Osso (sempre começa onde o músculo termina)
    const boneStart = muscleStart + actualMuscleThickness;
    let actualBoneThickness: number;
    if (boneThickness !== undefined) {
      actualBoneThickness = boneThickness;
    } else {
      // Se não especificado, osso preenche o restante até TOTAL_BLOCK_DEPTH
      actualBoneThickness = Math.max(0, TOTAL_BLOCK_DEPTH - boneStart);
    }
    const boneEnd = boneStart + actualBoneThickness;

    // Construir definições de camadas
    const layerDefs: LayerDefinition[] = [
      {
        type: 'skin',
        startDepth: skinStart,
        endDepth: skinEnd,
        thickness: skinThickness,
        color: TISSUE_COLORS.skin,
        borderColor: TISSUE_BORDER_COLORS.skin,
      },
      {
        type: 'fat',
        startDepth: fatStart,
        endDepth: fatEnd,
        thickness: fatThickness,
        color: TISSUE_COLORS.fat,
        borderColor: TISSUE_BORDER_COLORS.fat,
      },
      {
        type: 'muscle',
        startDepth: muscleStart,
        endDepth: muscleStart + actualMuscleThickness,
        thickness: actualMuscleThickness,
        color: TISSUE_COLORS.muscle,
        borderColor: TISSUE_BORDER_COLORS.muscle,
      },
    ];

    // Adicionar osso se houver espaço ou se boneThickness estiver definido
    if (actualBoneThickness > 0.01) {
      layerDefs.push({
        type: 'bone',
        startDepth: boneStart,
        endDepth: boneEnd,
        thickness: actualBoneThickness,
        color: TISSUE_COLORS.bone,
        borderColor: TISSUE_BORDER_COLORS.bone,
      });
    }

    return layerDefs;
  }, [scenario, customThicknesses]);

  return (
    <>
      {layers.map((layer, i) => {
        // V5: Skip layers below stopAtDepth
        if (stopAtDepth !== undefined && layer.startDepth >= stopAtDepth) {
          return null;
        }

        // Calcular posição Y (negativo porque Y aponta para baixo no 3D)
        // A posição Y do centro da caixa = -startDepth - thickness/2
        const centerDepth = (layer.startDepth + layer.endDepth) / 2;
        const yPos = -centerDepth;
        const height = layer.thickness;

        // Cores fixas e didáticas (sem variação)
        const baseColor = layer.color;

        // Semi-translucid layers so the beam is visible inside the volume
        const opacity =
          layer.type === 'skin' ? 0.65 :
          layer.type === 'fat' ? 0.42 :
          layer.type === 'muscle' ? 0.42 :
          0.75; // bone
        
        // Roughness alto para evitar reflexos que "lavam" a cor
        const baseRoughness = 0.85;
        
        // Metalness zero para cores mais puras
        const baseMetalness = 0.0;
        
        // Emissive com a mesma cor para compensar iluminação e tornar cores mais vibrantes
        // Intensidade ajustada por tipo de tecido (maior para cores mais escuras)
        const emissiveIntensity =
          layer.type === 'skin' ? 0.10 :
          layer.type === 'fat' ? 0.08 :
          layer.type === 'muscle' ? 0.08 :
          0.06;

        // Render order for correct transparency: deeper first, skin last
        const renderOrder =
          layer.type === 'bone' ? 0 :
          layer.type === 'muscle' ? 1 :
          layer.type === 'fat' ? 2 :
          3;

        return (
          <group key={`${layer.type}-${i}`}>
            {/* Main tissue layer */}
            <Box args={[20, height, 8]} position={[0, yPos, 0]} renderOrder={renderOrder}>
              <meshStandardMaterial 
                color={baseColor}
                transparent
                opacity={opacity}
                depthWrite={false}
                depthTest={true}
                roughness={baseRoughness}
                metalness={baseMetalness}
                emissive={baseColor}
                emissiveIntensity={emissiveIntensity}
                side={DoubleSide}
              />
            </Box>
            
            {/* Border/edge visualization for didactic clarity - linha escura entre camadas */}
            {i < layers.length - 1 && (
              <Box 
                args={[20.2, 0.02, 8.2]} 
                position={[0, yPos + height / 2, 0]}
                renderOrder={renderOrder + 0.1}
              >
                <meshStandardMaterial 
                  color="#1a1a1a" // Linha escura para separação clara
                  transparent
                  opacity={0.55}
                  depthWrite={false}
                  emissive="#000000"
                  emissiveIntensity={0}
                  roughness={1.0}
                  metalness={0}
                  side={DoubleSide}
                />
              </Box>
            )}
            
            {showLabels && (
              <Text
                position={[10.5, yPos, 0]}
                fontSize={0.3}
                color="white"
                anchorX="left"
              >
                {layer.type === 'skin' ? 'Pele' : 
                 layer.type === 'fat' ? 'Gordura' :
                 layer.type === 'muscle' ? 'Músculo' : 'Osso'}
              </Text>
            )}
          </group>
        );
      })}
    </>
  );
}
