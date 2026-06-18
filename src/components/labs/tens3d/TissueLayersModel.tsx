import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TissueConfig } from '@/types/tissueConfig';
import type { ClinicalSkinTone } from '@/lib/clinicalSkinTones';
import { CLINICAL_SKIN_TONES } from '@/lib/clinicalSkinTones';
import { shouldCastTherapeuticShadows } from '@/lib/therapeuticLabsPerformance';
import {
  clinicalTissueMaterialProps,
  createClinicalTissueTextureSet,
} from '@/lib/clinicalTissueTextures';
import {
  buildOrganicLayerGeometry,
  createTissueStackSeed,
  ORGANIC_LAYER_SEGMENTS,
  tissueBoundarySeed,
} from '@/lib/clinicalTissueGeometry';

const CAST_SHADOW = shouldCastTherapeuticShadows();

type VisualizationMode = 'anatomical' | 'electric' | 'lesion';

interface TissueLayersModelProps {
  tissueConfig: TissueConfig;
  visualMode: VisualizationMode;
  intensityNorm: number;
  lesionIndex?: number;
  skinTone?: ClinicalSkinTone;
}

export function TissueLayersModel({
  tissueConfig,
  visualMode,
  intensityNorm,
  lesionIndex = 0,
  skinTone,
}: TissueLayersModelProps) {
  const tone = skinTone ?? CLINICAL_SKIN_TONES[1];
  // Calculate layer dimensions - tissueConfig valores já estão normalizados (0-1)
  const { skinHeight, fatHeight, muscleHeight, boneHeight, skinY, fatY, muscleY, boneY } = useMemo(() => {
    // Multiplicar por 5 para ter dimensões visíveis (ao invés de /10)
    const skinH = tissueConfig.skinThickness * 5;
    const fatH = tissueConfig.fatThickness * 5;
    const muscleH = tissueConfig.muscleThickness * 5;
    const boneH = 0.5;

    // Calculate Y positions (stacking from top)
    let currentY = 0;
    const sY = currentY - skinH / 2;
    currentY -= skinH;
    const fY = currentY - fatH / 2;
    currentY -= fatH;
    const mY = currentY - muscleH / 2;
    currentY -= muscleH;
    const bY = currentY - boneH / 2;
    
    return {
      skinHeight: skinH,
      fatHeight: fatH,
      muscleHeight: muscleH,
      boneHeight: boneH,
      skinY: sY,
      fatY: fY,
      muscleY: mY,
      boneY: bY
    };
  }, [tissueConfig.skinThickness, tissueConfig.fatThickness, tissueConfig.muscleThickness]);

  const textures = useMemo(
    () => createClinicalTissueTextureSet({ skinTone: tone, lesionIndex }),
    [tone, lesionIndex],
  );

  const stackSeed = useMemo(() => createTissueStackSeed(), []);

  const layerGeometries = useMemo(() => {
    let idx = 0;
    const skinGeo = buildOrganicLayerGeometry({
      width: 20,
      height: skinHeight,
      depth: 8,
      boundarySeedTop: tissueBoundarySeed(stackSeed, idx),
      boundarySeedBottom: tissueBoundarySeed(stackSeed, idx + 1),
      kind: 'skin',
      topAmplitudeScale: 0.018,
      segments: ORGANIC_LAYER_SEGMENTS,
    });
    idx += 1;

    const fatGeo =
      tissueConfig.fatThickness > 0
        ? buildOrganicLayerGeometry({
            width: 20,
            height: fatHeight,
            depth: 8,
            boundarySeedTop: tissueBoundarySeed(stackSeed, idx),
            boundarySeedBottom: tissueBoundarySeed(stackSeed, idx + 1),
            kind: 'fat',
            segments: ORGANIC_LAYER_SEGMENTS,
          })
        : null;
    if (fatGeo) idx += 1;

    const muscleGeo = buildOrganicLayerGeometry({
      width: 20,
      height: muscleHeight,
      depth: 8,
      boundarySeedTop: tissueBoundarySeed(stackSeed, idx),
      boundarySeedBottom: tissueBoundarySeed(stackSeed, idx + 1),
      kind: 'muscle',
      segments: ORGANIC_LAYER_SEGMENTS,
    });
    idx += 1;

    const boneGeo = buildOrganicLayerGeometry({
      width: 20,
      height: boneHeight,
      depth: 8,
      boundarySeedTop: tissueBoundarySeed(stackSeed, idx),
      boundarySeedBottom: tissueBoundarySeed(stackSeed, idx + 1),
      kind: 'bone',
      segments: ORGANIC_LAYER_SEGMENTS,
    });

    return { skinGeo, fatGeo, muscleGeo, boneGeo };
  }, [
    stackSeed,
    skinHeight,
    fatHeight,
    muscleHeight,
    boneHeight,
    tissueConfig.fatThickness,
  ]);

  const getLayerEmissive = (layer: string) => {
    if (visualMode === 'electric' && intensityNorm > 0.3 && layer === 'muscle') {
      return new THREE.Color('#552020');
    }
    if (visualMode === 'lesion' && lesionIndex > 0.3 && layer === 'skin') {
      return new THREE.Color('#cc2222');
    }
    if (visualMode === 'lesion' && lesionIndex > 0.5 && layer === 'muscle') {
      return new THREE.Color('#771111');
    }
    return new THREE.Color('#000000');
  };

  const getLayerEmissiveIntensity = (layer: string) => {
    if (visualMode === 'electric' && intensityNorm > 0.3 && layer === 'muscle') {
      return intensityNorm * 0.35;
    }
    if (visualMode === 'lesion' && lesionIndex > 0.3 && layer === 'skin') {
      return (lesionIndex - 0.3) * 0.55;
    }
    if (visualMode === 'lesion' && lesionIndex > 0.5 && layer === 'muscle') {
      return (lesionIndex - 0.5) * 0.75;
    }
    return 0;
  };

  return (
    <group>
      {/* Skin Layer */}
      <mesh geometry={layerGeometries.skinGeo} position={[0, skinY, 0]} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
        <meshStandardMaterial
          {...clinicalTissueMaterialProps('skin', textures.skin)}
          emissive={getLayerEmissive('skin')}
          emissiveIntensity={getLayerEmissiveIntensity('skin')}
        />
      </mesh>

      {/* Fat Layer */}
      {layerGeometries.fatGeo && (
        <mesh geometry={layerGeometries.fatGeo} position={[0, fatY, 0]} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
          <meshStandardMaterial
            {...clinicalTissueMaterialProps('fat', textures.fat)}
            emissive={getLayerEmissive('fat')}
            emissiveIntensity={getLayerEmissiveIntensity('fat')}
          />
        </mesh>
      )}

      {/* Muscle Layer */}
      <mesh geometry={layerGeometries.muscleGeo} position={[0, muscleY, 0]} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
        <meshStandardMaterial
          {...clinicalTissueMaterialProps('muscle', textures.muscle)}
          emissive={getLayerEmissive('muscle')}
          emissiveIntensity={getLayerEmissiveIntensity('muscle')}
        />
      </mesh>

      {/* Bone Layer */}
      <mesh geometry={layerGeometries.boneGeo} position={[0, boneY, 0]} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
        <meshStandardMaterial
          {...clinicalTissueMaterialProps('bone', textures.bone)}
          emissive={getLayerEmissive('bone')}
          emissiveIntensity={getLayerEmissiveIntensity('bone')}
        />
      </mesh>

      {/* Metal Implant (if present) - AGORA USA PROFUNDIDADE E EXTENSÃO REAIS */}
      {tissueConfig.hasMetalImplant && tissueConfig.metalImplantDepth !== undefined && tissueConfig.metalImplantSpan !== undefined && (
        <group>
          <RoundedBox
            position={[
              0,
              skinY - (tissueConfig.metalImplantDepth * (skinHeight + fatHeight + muscleHeight)),
              0,
            ]}
            args={[
              tissueConfig.metalImplantSpan * 4,
              0.3,
              tissueConfig.metalImplantSpan * 3,
            ]}
            radius={0.08}
            smoothness={4}
            castShadow={CAST_SHADOW}
          >
            <meshStandardMaterial
              color="#475569"
              roughness={0.05}
              metalness={0.98}
              emissive={visualMode === 'electric' || visualMode === 'lesion' ? '#3b82f6' : '#60a5fa'}
              emissiveIntensity={visualMode === 'electric' ? intensityNorm * 1.0 : (visualMode === 'lesion' ? intensityNorm * 1.5 : 0.3)}
            />
          </RoundedBox>

          {(visualMode === 'electric' || visualMode === 'lesion') && intensityNorm > 0.2 && (
            <RoundedBox
              position={[
                0,
                skinY - (tissueConfig.metalImplantDepth * (skinHeight + fatHeight + muscleHeight)),
                0,
              ]}
              args={[
                tissueConfig.metalImplantSpan * 4.5,
                0.4,
                tissueConfig.metalImplantSpan * 3.5,
              ]}
              radius={0.1}
              smoothness={4}
            >
              <meshBasicMaterial
                color="#3b82f6"
                transparent
                opacity={intensityNorm * 0.3}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </RoundedBox>
          )}
        </group>
      )}

      {/* Inclusões Anatômicas */}
      {tissueConfig.inclusions && tissueConfig.inclusions.map((inclusion) => {
        const totalDepth = skinHeight + fatHeight + muscleHeight;
        const inclusionY = skinY - (inclusion.depth * totalDepth);
        const inclusionX = (inclusion.position - 0.5) * 16; // Posição entre eletrodos (-8 a +8) para acomodar distâncias maiores
        const inclusionWidth = inclusion.span * 2;
        const inclusionHeight = inclusion.span * 0.5;
        
        let inclusionColor = '#64748b';
        let inclusionEmissive = '#000000';
        
        if (inclusion.type === 'bone') {
          inclusionColor = '#cbd5e1';
          inclusionEmissive = visualMode === 'electric' ? '#fbbf24' : '#000000';
        } else if (inclusion.type === 'muscle') {
          inclusionColor = '#dc2626';
          inclusionEmissive = visualMode === 'electric' ? '#ef4444' : '#000000';
        } else if (inclusion.type === 'fat') {
          inclusionColor = '#fcd34d';
          inclusionEmissive = '#000000';
        } else if (inclusion.type === 'metal_implant') {
          inclusionColor = '#64748b';
          inclusionEmissive = visualMode === 'electric' ? '#3b82f6' : '#000000';
        }
        
        if (inclusion.type === 'bone' || inclusion.type === 'metal_implant') {
          return (
            <RoundedBox
              key={inclusion.id}
              position={[inclusionX, inclusionY, 0]}
              args={[inclusionWidth, inclusionHeight, 1.3]}
              radius={0.14}
              smoothness={4}
              castShadow={CAST_SHADOW}
            >
              <meshStandardMaterial
                color={inclusionColor}
                roughness={inclusion.type === 'metal_implant' ? 0.1 : 0.55}
                metalness={inclusion.type === 'metal_implant' ? 0.95 : 0.15}
                emissive={inclusionEmissive}
                emissiveIntensity={visualMode === 'electric' ? intensityNorm * 0.6 : 0}
              />
            </RoundedBox>
          );
        }

        return (
          <mesh
            key={inclusion.id}
            position={[inclusionX, inclusionY, 0]}
            scale={
              inclusion.type === 'fat'
                ? [inclusionWidth * 1.1, inclusionHeight * 1.2, 1.2]
                : [inclusionWidth * 0.95, inclusionHeight * 0.9, 1.1]
            }
            castShadow={CAST_SHADOW}
          >
            <sphereGeometry args={[0.55, 20, 16]} />
            <meshStandardMaterial
              color={inclusionColor}
              roughness={0.65}
              metalness={0.15}
              emissive={inclusionEmissive}
              emissiveIntensity={visualMode === 'electric' ? intensityNorm * 0.5 : 0}
            />
          </mesh>
        );
      })}

      {/* Layer Labels (when in anatomical mode) */}
      {visualMode === 'anatomical' && (
        <group>
          <LabelSprite text="Pele" position={[10.5, skinY, 0]} />
          {tissueConfig.fatThickness > 0 && (
            <LabelSprite text="Gordura" position={[10.5, fatY, 0]} />
          )}
          <LabelSprite text="Músculo" position={[10.5, muscleY, 0]} />
          <LabelSprite text="Osso" position={[10.5, boneY, 0]} />
          {tissueConfig.hasMetalImplant && (
            <LabelSprite
              text="Implante"
              position={[10.5, skinY - (tissueConfig.metalImplantDepth || 0) / 10, 0]}
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
