import { UltrasoundAnatomyPreset, UltrasoundAnatomyPresetId } from "@/types/ultrasoundPresets";
import { UltrasoundLayerConfig, UltrasoundInclusionConfig } from "@/types/acousticMedia";

/**
 * ANATOMICAL ULTRASOUND PRESETS - ENHANCED REALISM
 * 
 * 7 high-quality presets focused on clinical accuracy
 * Includes both linear (superficial) and convex (deep) transducer types
 * 
 * References:
 * 1. Bianchi S, Martinoli C. "Ultrasound of the Musculoskeletal System" Springer 2007
 * 2. CARDIA Study "Carotid Ultrasound Protocol" - vessel depth 15-25mm, diameter 6-8mm
 * 3. Rumack CM et al. "Diagnostic Ultrasound" 5th Ed - Abdominal imaging protocols
 * 4. AIUM Practice Guidelines for musculoskeletal and vascular imaging
 */

export function getDefaultLayersForPreset(presetId: UltrasoundAnatomyPresetId): UltrasoundLayerConfig[] {
  const layerSets: Record<UltrasoundAnatomyPresetId, UltrasoundLayerConfig[]> = {
    // ============================================================
    // CUSTOM - Configuração manual de camadas
    // ============================================================
    custom: [
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.2, noiseScale: 1.4, reflectivityBias: 0.08 },
      { id: "subcut", mediumId: "fat", name: "Subcutâneo", thicknessCm: 0.5, noiseScale: 0.75, reflectivityBias: -0.18 },
      { id: "muscle", mediumId: "muscle", name: "Músculo", thicknessCm: 2.0, noiseScale: 1.1, reflectivityBias: 0 },
    ],
    
    // ============================================================
    // TENDÃO SUPERFICIAL - Estrutura fibrilar com padrão estriado
    // ============================================================
    msk_tendon_upper_limb: [
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.08, noiseScale: 1.5, reflectivityBias: 0.10 },
      { id: "subcut", mediumId: "fat", name: "Tecido Subcutâneo", thicknessCm: 0.12, noiseScale: 0.7, reflectivityBias: -0.20 },
      { id: "paratenon", mediumId: "fascia", name: "Paratendão", thicknessCm: 0.02, noiseScale: 2.5, reflectivityBias: 0.55 },
      { id: "tendon", mediumId: "tendon", name: "Tendão (Fibras Paralelas)", thicknessCm: 0.38, noiseScale: 2.0, reflectivityBias: 0.45 },
      { id: "periosteum", mediumId: "fascia", name: "Periósteo", thicknessCm: 0.02, noiseScale: 2.3, reflectivityBias: 0.50 },
      { id: "bone", mediumId: "bone_cortical", name: "Cortical Óssea", thicknessCm: 0.25, noiseScale: 0.2, reflectivityBias: 0.70 },
    ],
    
    // ============================================================
    // OMBRO - Manguito rotador com bursa e interface óssea clara
    // ============================================================
    shoulder_supraspinatus_long: [
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.10, noiseScale: 1.4, reflectivityBias: 0.08 },
      { id: "subcut", mediumId: "fat", name: "Gordura Subcutânea", thicknessCm: 0.35, noiseScale: 0.75, reflectivityBias: -0.22 },
      { id: "deltoid", mediumId: "muscle", name: "Músculo Deltoide", thicknessCm: 0.85, noiseScale: 1.1, reflectivityBias: -0.05 },
      { id: "bursa", mediumId: "water", name: "Bursa Subacromial", thicknessCm: 0.12, noiseScale: 0.3, reflectivityBias: -0.80 },
      { id: "tendon", mediumId: "tendon", name: "Supraespinhal", thicknessCm: 0.50, noiseScale: 1.9, reflectivityBias: 0.40 },
      { id: "cartilage", mediumId: "cartilage", name: "Cartilagem Hialina", thicknessCm: 0.18, noiseScale: 1.2, reflectivityBias: 0.10 },
      { id: "bone", mediumId: "bone_cortical", name: "Úmero (Cortical)", thicknessCm: 0.35, noiseScale: 0.2, reflectivityBias: 0.75 },
    ],
    
    // ============================================================
    // CARÓTIDA LONGITUDINAL - Eixo Longo (Anatomia Clínica Real)
    // 
    // Referências: AIUM Vascular Guidelines, CARDIA Study Protocol
    // Profundidade ACC: 1.5-2.5 cm | Diâmetro: 6-8 mm | IMT: 0.5-0.9 mm
    // Frequência: 7-10 MHz | Profundidade: 3-4 cm | Foco: 1.2-1.6 cm
    // ============================================================
    carotid_long: [
      // Camada 1: Pele - fina linha hiperecogênica (1-2mm)
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.15, noiseScale: 1.2, reflectivityBias: 0.12 },
      
      // Camada 2: Tecido subcutâneo - textura fina, ecogenicidade média
      { id: "subcut", mediumId: "fat", name: "Tecido Subcutâneo", thicknessCm: 0.40, noiseScale: 0.65, reflectivityBias: -0.15 },
      
      // Camada 3: Músculo Platisma - fina camada muscular superficial
      { id: "platysma", mediumId: "muscle", name: "Músculo Platisma", thicknessCm: 0.12, noiseScale: 1.0, reflectivityBias: -0.08 },
      
      // Camada 4: Fáscia cervical superficial
      { id: "fascia_superficial", mediumId: "fascia", name: "Fáscia Cervical", thicknessCm: 0.03, noiseScale: 2.0, reflectivityBias: 0.45 },
      
      // Camada 5: Músculo Esternocleidomastoideo (ECM) - hipoecoico com estrias longas
      { id: "scm", mediumId: "muscle", name: "Esternocleidomastoideo", thicknessCm: 0.55, noiseScale: 1.05, reflectivityBias: -0.05 },
      
      // Camada 6: Bainha carotídea - tecido conjuntivo perivascular
      { id: "carotid_sheath", mediumId: "fat", name: "Bainha Carotídea", thicknessCm: 0.20, noiseScale: 0.55, reflectivityBias: -0.12 },
      
      // Camada 7: Parede arterial anterior (linha dupla íntima-média - ~0.7mm IMT)
      { id: "wall_anterior", mediumId: "fascia", name: "Parede Anterior ACC", thicknessCm: 0.07, noiseScale: 2.8, reflectivityBias: 0.68 },
      
      // Camada 8: Lúmen arterial - completamente anecóico (sangue)
      { id: "lumen", mediumId: "blood", name: "Lúmen ACC", thicknessCm: 0.70, noiseScale: 0.08, reflectivityBias: -0.98 },
      
      // Camada 9: Parede arterial posterior (mais brilhante - reflexão especular)
      { id: "wall_posterior", mediumId: "fascia", name: "Parede Posterior ACC", thicknessCm: 0.07, noiseScale: 2.8, reflectivityBias: 0.75 },
      
      // Camada 10: Tecido pré-vertebral profundo - transição gradual
      { id: "prevertebral", mediumId: "muscle", name: "Músculos Pré-vertebrais", thicknessCm: 1.8, noiseScale: 0.95, reflectivityBias: -0.02 },
    ],
    
    // ============================================================
    // CARÓTIDA TRANSVERSAL - Eixo Curto (Anatomia Clínica Real)
    // 
    // Referências: AIUM Vascular Guidelines, Radiology Masterclass
    // ACC: circular ~7mm | VJI: oval 8-12mm lateral à ACC
    // Frequência: 10-12 MHz | Profundidade: 2-3 cm | Foco: 1.0-1.3 cm
    // ============================================================
    carotid_trans: [
      // Camada 1: Pele - linha ecogênica fina
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.12, noiseScale: 1.2, reflectivityBias: 0.12 },
      
      // Camada 2: Subcutâneo - textura fina com granularidade suave
      { id: "subcut", mediumId: "fat", name: "Tecido Subcutâneo", thicknessCm: 0.35, noiseScale: 0.60, reflectivityBias: -0.12 },
      
      // Camada 3: Platisma
      { id: "platysma", mediumId: "muscle", name: "Platisma", thicknessCm: 0.10, noiseScale: 1.0, reflectivityBias: -0.08 },
      
      // Camada 4: ECM - hipoecoico com estriações transversais
      { id: "scm", mediumId: "muscle", name: "Esternocleidomastoideo", thicknessCm: 0.65, noiseScale: 1.08, reflectivityBias: -0.03 },
      
      // Camada 5: Bainha carotídea periférica
      { id: "carotid_sheath", mediumId: "fat", name: "Bainha Carotídea", thicknessCm: 0.18, noiseScale: 0.50, reflectivityBias: -0.10 },
      
      // Camada 6: Plano profundo - músculos pré-vertebrais
      { id: "prevertebral", mediumId: "muscle", name: "Músculos Profundos", thicknessCm: 2.2, noiseScale: 0.92, reflectivityBias: -0.02 },
    ],
    
    // ============================================================
    // MÚSCULO GENÉRICO - Padrão fibrilar com septos brilhantes
    // ============================================================
    muscle_generic: [
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.12, noiseScale: 1.4, reflectivityBias: 0.08 },
      { id: "subcut", mediumId: "fat", name: "Gordura", thicknessCm: 0.45, noiseScale: 0.75, reflectivityBias: -0.18 },
      { id: "superficial_fascia", mediumId: "fascia", name: "Fáscia Superficial", thicknessCm: 0.03, noiseScale: 2.2, reflectivityBias: 0.48 },
      { id: "muscle_belly", mediumId: "muscle", name: "Ventre Muscular", thicknessCm: 2.0, noiseScale: 1.15, reflectivityBias: 0.05 },
      { id: "intermuscular_septum", mediumId: "fascia", name: "Septo Intermuscular", thicknessCm: 0.04, noiseScale: 2.3, reflectivityBias: 0.50 },
      { id: "deep_muscle", mediumId: "muscle", name: "Músculo Profundo", thicknessCm: 1.2, noiseScale: 1.1, reflectivityBias: 0.0 },
      { id: "deep_fascia", mediumId: "fascia", name: "Fáscia Profunda", thicknessCm: 0.03, noiseScale: 2.2, reflectivityBias: 0.48 },
    ],
    
    // ============================================================
    // FÍGADO - Parênquima homogêneo (CONVEXO)
    // ============================================================
    liver_standard: [
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.15, noiseScale: 1.3, reflectivityBias: 0.08 },
      { id: "subcut", mediumId: "fat", name: "Tecido Subcutâneo", thicknessCm: 1.2, noiseScale: 0.7, reflectivityBias: -0.20 },
      { id: "muscle", mediumId: "muscle", name: "Parede Abdominal", thicknessCm: 0.8, noiseScale: 1.05, reflectivityBias: 0.0 },
      { id: "peritoneum", mediumId: "fascia", name: "Peritônio", thicknessCm: 0.02, noiseScale: 2.5, reflectivityBias: 0.55 },
      { id: "liver_capsule", mediumId: "fascia", name: "Cápsula Hepática", thicknessCm: 0.02, noiseScale: 2.3, reflectivityBias: 0.50 },
      { id: "liver_parenchyma", mediumId: "liver", name: "Parênquima Hepático", thicknessCm: 8.0, noiseScale: 1.0, reflectivityBias: 0.12 },
    ],
    
    // ============================================================
    // VESÍCULA BILIAR - Estrutura anecoica com parede (CONVEXO)
    // ============================================================
    gallbladder_standard: [
      { id: "skin", mediumId: "skin", name: "Pele", thicknessCm: 0.15, noiseScale: 1.3, reflectivityBias: 0.08 },
      { id: "subcut", mediumId: "fat", name: "Gordura Subcutânea", thicknessCm: 1.5, noiseScale: 0.7, reflectivityBias: -0.20 },
      { id: "muscle", mediumId: "muscle", name: "Parede Abdominal", thicknessCm: 0.7, noiseScale: 1.05, reflectivityBias: 0.0 },
      { id: "liver_anterior", mediumId: "liver", name: "Fígado (Anterior)", thicknessCm: 3.5, noiseScale: 1.0, reflectivityBias: 0.12 },
      { id: "gb_wall", mediumId: "fascia", name: "Parede da Vesícula", thicknessCm: 0.03, noiseScale: 2.5, reflectivityBias: 0.58 },
      { id: "gb_lumen", mediumId: "water", name: "Bile (Lúmen)", thicknessCm: 1.2, noiseScale: 0.2, reflectivityBias: -0.85 },
      { id: "liver_posterior", mediumId: "liver", name: "Fígado (Posterior)", thicknessCm: 2.5, noiseScale: 1.0, reflectivityBias: 0.12 },
    ],
  };
  
  return layerSets[presetId] || layerSets.muscle_generic;
}

export function getDefaultInclusionsForPreset(presetId: UltrasoundAnatomyPresetId): UltrasoundInclusionConfig[] {
  const inclusionSets: Record<UltrasoundAnatomyPresetId, UltrasoundInclusionConfig[]> = {
    custom: [],
    msk_tendon_upper_limb: [],
    shoulder_supraspinatus_long: [],
    muscle_generic: [],
    liver_standard: [],
    gallbladder_standard: [],
    
    // ============================================================
    // CARÓTIDA LONGITUDINAL - Inclusões Vasculares
    // ACC alongada horizontalmente com paredes duplas visíveis
    // ============================================================
    carotid_long: [
      {
        id: "carotid_artery_longitudinal",
        type: "vessel",
        label: "Artéria Carótida Comum (Longitudinal)",
        shape: "ellipse",
        // Profundidade: ~1.8cm (centro do vaso após camadas superficiais)
        centerDepthCm: 1.82,
        // Centralizado na imagem
        centerLateralPos: 0,
        // Largura extensa (vaso alongado no eixo longo) x altura = diâmetro 7mm
        sizeCm: { width: 2.8, height: 0.70 },
        mediumInsideId: "blood",
        // Sombra acústica muito sutil (vasos não geram sombra forte)
        hasStrongShadow: false,
        // Reforço acústico posterior (característico de estruturas líquidas)
        posteriorEnhancement: true,
        // Bordas suaves - paredes arteriais com transição gradual
        borderEchogenicity: "soft",
      },
    ],
    
    // ============================================================
    // CARÓTIDA TRANSVERSAL - Inclusões Vasculares
    // ACC circular (~7mm) + VJI oval (~10mm) lateral
    // ============================================================
    carotid_trans: [
      // Artéria Carótida Comum - círculo/levemente oval
      {
        id: "carotid_artery_transverse",
        type: "vessel",
        label: "Artéria Carótida Comum",
        shape: "ellipse",
        // Profundidade: ~1.5cm da superfície
        centerDepthCm: 1.50,
        // Posição medial (ligeiramente à esquerda do centro)
        centerLateralPos: -0.25,
        // Diâmetro interno ~7mm (quase circular no corte transversal)
        sizeCm: { width: 0.70, height: 0.70 },
        mediumInsideId: "blood",
        hasStrongShadow: false,
        posteriorEnhancement: true,
        borderEchogenicity: "soft",
      },
      // Veia Jugular Interna - oval, maior, lateral à artéria
      {
        id: "internal_jugular_vein",
        type: "vessel",
        label: "Veia Jugular Interna",
        shape: "ellipse",
        // Ligeiramente mais superficial que a artéria
        centerDepthCm: 1.35,
        // Lateral (à direita) da carótida
        centerLateralPos: 0.50,
        // Oval maior: 10mm largura x 8mm altura (compressível)
        sizeCm: { width: 1.00, height: 0.80 },
        mediumInsideId: "blood",
        hasStrongShadow: false,
        posteriorEnhancement: true,
        // Bordas mais suaves que artéria (parede venosa mais fina)
        borderEchogenicity: "soft",
      },
    ],
  };
  
  return inclusionSets[presetId] || [];
}

/**
 * ULTRASOUND ANATOMY PRESETS - COMPLETE DEFINITIONS
 */
export const ULTRASOUND_PRESETS: Record<UltrasoundAnatomyPresetId, UltrasoundAnatomyPreset> = {
  // ===========================
  // CUSTOM - CONFIGURAÇÃO MANUAL
  // ===========================
  custom: {
    id: "custom",
    label: "Personalizado",
    shortDescription: "Configure manualmente todas as camadas e inclusões",
    clinicalTagline: "Composição de tecidos totalmente customizável para seus objetivos pedagógicos",
    transducerType: "linear",
    recommendedFrequencyMHz: 7.5,
    recommendedDepthCm: 4.0,
    recommendedFocusCm: 2.0,
    recommendedGain: 50,
    tissueProfile: "muscle",
    vesselCount: 0,
    hasBoneInterface: false,
    hasStrongShadow: false,
    noiseSeed: 0,
    speckleIntensity: 1.0,
    layerBrightness: [1.0, 1.0, 1.0],
  },
  
  // ===========================
  // LINEAR TRANSDUCER PRESETS
  // ===========================
  
  msk_tendon_upper_limb: {
    id: "msk_tendon_upper_limb",
    label: "Tendão Superficial MSK",
    shortDescription: "Tendões extensores/flexores - antebraço/punho",
    clinicalTagline: "Tendinopatias, rupturas, tenossinovite - padrão fibrilar hiperecogênico",
    transducerType: "linear",
    recommendedFrequencyMHz: 12.0,
    recommendedDepthCm: 2.0,
    recommendedFocusCm: 0.8,
    recommendedGain: 58,
    tissueProfile: "tendon",
    vesselCount: 0,
    hasBoneInterface: true,
    hasStrongShadow: true,
    noiseSeed: 111,
    speckleIntensity: 1.15,
    layerBrightness: [0.85, 0.55, 1.5, 1.4, 1.5, 1.8],
  },
  
  shoulder_supraspinatus_long: {
    id: "shoulder_supraspinatus_long",
    label: "Ombro - Manguito Rotador",
    shortDescription: "Supraespinhal - eixo longitudinal",
    clinicalTagline: "Lesões do manguito, bursites, rupturas - visualização da bursa e tendão",
    transducerType: "linear",
    recommendedFrequencyMHz: 10.0,
    recommendedDepthCm: 3.2,
    recommendedFocusCm: 2.0,
    recommendedGain: 52,
    tissueProfile: "tendon",
    vesselCount: 0,
    hasBoneInterface: true,
    hasStrongShadow: true,
    noiseSeed: 222,
    speckleIntensity: 1.05,
    layerBrightness: [0.85, 0.6, 0.88, 0.35, 1.35, 1.05, 1.8],
  },
  
  // ============================================================
  // CARÓTIDA LONGITUDINAL - Eixo Longo
  // Parâmetros clínicos reais para avaliação vascular
  // ============================================================
  carotid_long: {
    id: "carotid_long",
    label: "Carótida - Longitudinal",
    shortDescription: "Artéria carótida comum - eixo longo",
    clinicalTagline: "Medição IMT (íntima-média), detecção de placas, avaliação de estenose",
    transducerType: "linear",
    // Frequência: 7-10 MHz (penetração adequada para 3-4cm)
    recommendedFrequencyMHz: 8.0,
    // Profundidade: 3-4 cm para visualizar estruturas pré-vertebrais
    recommendedDepthCm: 3.5,
    // Foco na profundidade do vaso (~1.5cm)
    recommendedFocusCm: 1.5,
    // Ganho moderado para bom contraste lúmen/parede
    recommendedGain: 45,
    tissueProfile: "vascular",
    vesselCount: 1,
    hasBoneInterface: false,
    hasStrongShadow: false,
    noiseSeed: 333,
    // Speckle moderado (menos denso com frequência mais baixa)
    speckleIntensity: 0.72,
    // Brilho por camada: pele, subcut, platisma, fáscia, ECM, bainha, parede ant, lúmen, parede post, pré-vertebral
    layerBrightness: [0.90, 0.55, 0.75, 1.40, 0.80, 0.52, 1.65, 0.08, 1.72, 0.78],
  },
  
  // ============================================================
  // CARÓTIDA TRANSVERSAL - Eixo Curto
  // Parâmetros clínicos para avaliação em corte axial
  // ============================================================
  carotid_trans: {
    id: "carotid_trans",
    label: "Carótida - Transversal",
    shortDescription: "Artéria carótida e veia jugular - eixo curto",
    clinicalTagline: "Anatomia vascular cervical, diferenciação artéria/veia, compressibilidade",
    transducerType: "linear",
    // Alta frequência para resolução superficial
    recommendedFrequencyMHz: 10.0,
    // Profundidade: 2.5-3 cm suficiente para estruturas vasculares
    recommendedDepthCm: 2.8,
    // Foco na profundidade dos vasos (~1.2cm)
    recommendedFocusCm: 1.2,
    // Ganho moderado-baixo
    recommendedGain: 48,
    tissueProfile: "vascular",
    vesselCount: 2,
    hasBoneInterface: false,
    hasStrongShadow: false,
    noiseSeed: 444,
    // Speckle fino (alta frequência = textura mais densa)
    speckleIntensity: 0.85,
    // Brilho por camada: pele, subcut, platisma, ECM, bainha, pré-vertebral
    layerBrightness: [0.90, 0.55, 0.75, 0.78, 0.50, 0.75],
  },
  
  muscle_generic: {
    id: "muscle_generic",
    label: "Músculo Genérico",
    shortDescription: "Estrutura muscular esquelética básica",
    clinicalTagline: "Identificação de camadas, fascias, padrão fibrilar - ensino fundamental",
    transducerType: "linear",
    recommendedFrequencyMHz: 10.0,
    recommendedDepthCm: 4.2,
    recommendedFocusCm: 2.2,
    recommendedGain: 54,
    tissueProfile: "muscle",
    vesselCount: 0,
    hasBoneInterface: false,
    hasStrongShadow: false,
    noiseSeed: 555,
    speckleIntensity: 1.0,
    layerBrightness: [0.85, 0.65, 1.4, 0.98, 1.45, 0.95, 1.4],
  },
  
  // ===========================
  // CONVEX TRANSDUCER PRESETS
  // ===========================
  
  liver_standard: {
    id: "liver_standard",
    label: "Fígado - Parênquima",
    shortDescription: "Parênquima hepático homogêneo",
    clinicalTagline: "Esteatose, cirrose, massas hepáticas - textura parenquimatosa uniforme",
    transducerType: "convex",
    recommendedFrequencyMHz: 5.0,
    recommendedDepthCm: 12.0,
    recommendedFocusCm: 6.0,
    recommendedGain: 55,
    tissueProfile: "liver_like",
    vesselCount: 0,
    hasBoneInterface: false,
    hasStrongShadow: false,
    noiseSeed: 666,
    speckleIntensity: 0.95,
    layerBrightness: [0.85, 0.6, 0.92, 2.2, 2.2, 1.1],
  },
  
  gallbladder_standard: {
    id: "gallbladder_standard",
    label: "Vesícula Biliar",
    shortDescription: "Vesícula com bile anecoica",
    clinicalTagline: "Colelitíase, colecistite, espessamento parietal - estrutura anecoica clássica",
    transducerType: "convex",
    recommendedFrequencyMHz: 5.0,
    recommendedDepthCm: 10.0,
    recommendedFocusCm: 5.5,
    recommendedGain: 52,
    tissueProfile: "abdominal",
    vesselCount: 0,
    hasBoneInterface: false,
    hasStrongShadow: false,
    noiseSeed: 777,
    speckleIntensity: 0.9,
    layerBrightness: [0.85, 0.6, 0.92, 1.1, 1.5, 0.2, 1.1],
  },
};

/**
 * Utility functions
 */
export function getPresetById(id: UltrasoundAnatomyPresetId): UltrasoundAnatomyPreset {
  return ULTRASOUND_PRESETS[id];
}

export function getAllPresets(): UltrasoundAnatomyPreset[] {
  return Object.values(ULTRASOUND_PRESETS);
}

export function getPresetsByTransducer(type: "linear" | "convex" | "microconvex"): UltrasoundAnatomyPreset[] {
  return Object.values(ULTRASOUND_PRESETS).filter(preset => preset.transducerType === type);
}
