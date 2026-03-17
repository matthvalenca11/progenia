/**
 * MRI Lab Store - Zustand store for MRI Lab state
 * CONTRATO FORTE: volumeReady === true significa volume válido disponível
 */

import { create, StateCreator } from "zustand";
import { MRILabConfig, defaultMRILabConfig, VolumeMRI, DICOMSeries } from "@/types/mriLabConfig";
import { simulateMRI, MRISimulationResult, applyMRIPreset } from "@/simulation/mriEngine";
import { NormalizedVolume, ParsedVolume } from "@/lib/mri/volumeTypes";
import { loadVolume } from "@/lib/mri/volumeLoader";

export interface DICOMVolume {
  width: number;  // Rows
  height: number; // Columns
  depth: number;  // Number of slices
  voxels: Int16Array | Float32Array;
  min: number;
  max: number;
  pixelSpacing: [number, number] | null;
  sliceThickness: number | null;
  spacingBetweenSlices: number | null;
}

// State-only interface (properties only)
interface MRILabState {
  config: MRILabConfig;
  volume: VolumeMRI | null;
  volumeReady: boolean;
  simulationResult: MRISimulationResult | null;
  simulationError: string | null;
  isSimulating: boolean;
  storeInstanceId: string;
  lastSimulatedConfigHash: string;
  lastSimulationAt: number | null;
  dicomSeries: DICOMSeries | null;
  dicomVolume: DICOMVolume | null;
  // Volumes de referência para simulação por interpolação (ex.: T1 e T2 reais)
  dicomVolumeA: DICOMVolume | null; // T1
  dicomVolumeB: DICOMVolume | null; // T2
  // Volumes clínicos adicionais (quando disponíveis no caso)
  dicomVolumeFlair?: DICOMVolume | null;
  dicomVolumeT1ce?: DICOMVolume | null;
  // Volume de segmentação (ex.: BraTS *_seg.nii) para overlay de lesão
  segmentationVolume: DICOMVolume | null;
  dicomReady: boolean;
  dicomError: string | null;
  normalizedVolume: NormalizedVolume | null;
  volumeLoadError: string | null;
  isLoadingVolume: boolean;
  realVolumeTR?: number;
  realVolumeTE?: number;
  // Clinical case management
  currentCaseId?: string | null;
  loadingCase: boolean;
  caseError: string | null;
  caseMetadataA?: ParsedVolume["metadata"] | null;
  caseMetadataB?: ParsedVolume["metadata"] | null;
  // Sequência clínica ativa compartilhada entre Fatia 2D e MPR (T1, T2, FLAIR, T1ce)
  activeSequence?: "t1" | "t2" | "flair" | "t1ce";
  // Rotações atuais do MPR (graus, múltiplos de 90)
  mprAxialRotation?: number;
  mprSagittalRotation?: number;
  mprCoronalRotation?: number;
}

// Actions interface
interface MRILabActions {
  initIfNeeded: (reason: string, configOverride?: MRILabConfig) => void;
  setLabConfig: (config: MRILabConfig) => void;
  updateConfig: (updates: Partial<MRILabConfig>) => void;
  runSimulation: () => void;
  setDicomSeries: (series: DICOMSeries) => void;
  buildDicomVolume: (series: DICOMSeries) => DICOMVolume;
  setNIfTIVolume: (volume: DICOMVolume, metadata?: any) => void;
  loadVolumeFromFiles: (files: File[], onProgress?: (progress: number) => void) => Promise<void>;
  setNormalizedVolume: (volume: NormalizedVolume) => void;
  clearVolume: () => void;
  // Blend factor para interpolação entre séries reais (0=T1-like, 1=T2-like)
  getBlendFactor: () => number;
  // Sincronização global de fatias (console de comando)
  syncSlices: (newIndex: number) => void;
  // Carregar um caso clínico (ex.: T1/T2 encéfalo)
  loadClinicalCase: (caseId: string) => Promise<void>;
  // Selecionar sequência clínica globalmente (sincroniza Fatia 2D e MPR)
  setActiveSequence: (seq: "t1" | "t2" | "flair" | "t1ce") => void;
  // Atualizar rotações do MPR e mantê-las entre trocas de aba
  setMprRotations: (rot: {
    axial?: number;
    sagittal?: number;
    coronal?: number;
  }) => void;
}

// Combined store interface
interface MRILabStore extends MRILabState, MRILabActions {}

// Generate unique store instance ID (singleton - created once)
const STORE_INSTANCE_ID = `mri-store-${Math.random().toString(16).slice(2)}-${Date.now()}`;
console.log(`[MRI Store] Creating store instance: ${STORE_INSTANCE_ID}`);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Zustand v5 strict type inference with complex async stores
export const useMRILabStore = create<MRILabStore>()((set, get) => {
  // Phantom simulation inicial desativada para este lab:
  // começamos sem volume phantom e sem rodar simulateMRI aqui.
  let initialVolume: VolumeMRI | null = null;
  let initialVolumeReady = false;
  let initialSimulationResult: MRISimulationResult | null = null;
  let initialSimulationError: string | null = null;
  let initialSliceIndex = 0;
  console.log("[MRI Store] Initializing store (sem simulação phantom inicial)");
  
  // Helper to generate config hash
  const generateConfigHash = (cfg: MRILabConfig): string => {
    return `${cfg.phantomType}-${cfg.tr}-${cfg.te}-${cfg.flipAngle}-${cfg.preset}-${cfg.sequenceType}`;
  };
  
  // Build initial config with sliceIndex set
  const initialConfig = { ...defaultMRILabConfig, sliceIndex: initialSliceIndex };
  
  return {
    // State properties - explicitly typed
    config: initialConfig,
    volume: initialVolume,
    volumeReady: initialVolumeReady,
    simulationResult: initialSimulationResult,
    simulationError: initialSimulationError,
    isSimulating: false,
    storeInstanceId: STORE_INSTANCE_ID,
    lastSimulatedConfigHash: initialVolumeReady ? generateConfigHash(initialConfig) : "",
    lastSimulationAt: initialVolumeReady ? Date.now() : null,
    dicomSeries: null as DICOMSeries | null,
    dicomVolume: null as DICOMVolume | null,
    dicomVolumeA: null as DICOMVolume | null,
    dicomVolumeB: null as DICOMVolume | null,
    dicomVolumeFlair: null,
    dicomVolumeT1ce: null,
    segmentationVolume: null as DICOMVolume | null,
    dicomReady: false,
    dicomError: null as string | null,
    normalizedVolume: null as NormalizedVolume | null,
    volumeLoadError: null as string | null,
    isLoadingVolume: false,
    realVolumeTR: undefined,
    realVolumeTE: undefined,
    currentCaseId: null,
    loadingCase: false,
    caseError: null,
    caseMetadataA: null,
    caseMetadataB: null,
    activeSequence: "t1",
    mprAxialRotation: 0,
    mprSagittalRotation: 0,
    mprCoronalRotation: 0,
    
    // Methods
    initIfNeeded: (reason: string, configOverride?: MRILabConfig) => {
      const state = get();
      console.log(
        `[MRI Store] initIfNeeded called (phantom simulation desativado) - reason: ${reason}, volumeReady: ${state.volumeReady}, isSimulating: ${state.isSimulating}`
      );

      // Para este lab, desativamos completamente a simulação phantom.
      // Apenas aplicamos overrides de config relacionados a DICOM/NIfTI, se existirem.
      if (configOverride) {
        console.log(`[MRI Store] initIfNeeded: Applying config override (sem simulateMRI)`, {
          dataSource: configOverride.dataSource,
          hasDicomSeries: !!configOverride.dicomSeries,
          hasNiftiVolume: !!configOverride.niftiVolume,
        });

        set({ config: { ...state.config, ...configOverride }, simulationError: null, dicomError: null });

        if (configOverride.dicomSeries && configOverride.dataSource === "dicom") {
          get().setDicomSeries(configOverride.dicomSeries);
        }

        if (configOverride.niftiVolume && configOverride.dataSource === "nifti") {
          get().setNIfTIVolume(configOverride.niftiVolume);
        }
      }

      return;
    },
    
    setLabConfig: (config) => {
      set({ config, simulationError: null });
      // Don't call runSimulation here - let the component handle it via useEffect
      // This prevents loops when config prop changes
    },
  
    updateConfig: (updates) => {
      const currentConfig = get().config;
      const newConfig = { ...currentConfig, ...updates };
      
      // Apply preset if preset changed
      if (updates.preset && updates.preset !== currentConfig.preset) {
        const presetConfig = applyMRIPreset(updates.preset);
        Object.assign(newConfig, presetConfig);
      }
      
      // Reset sliceIndex if phantomType changed
      if (updates.phantomType && updates.phantomType !== currentConfig.phantomType) {
        newConfig.sliceIndex = 0;
      }
      
      set({ config: newConfig, simulationError: null });
      // Don't call runSimulation here - let the component handle it via useEffect
      // This prevents loops
    },
  
    runSimulation: () => {
      // Desativado: não queremos mais chamar simulateMRI nem gerar phantom.
      console.log("[MRI Store] runSimulation() chamado, mas o simulador phantom foi desativado para este lab.");
      return;
    },
    
    buildDicomVolume: (series: DICOMSeries): DICOMVolume => {
      console.log("[MRI Store] buildDicomVolume called with series:", {
        totalSlices: series.totalSlices,
        rows: series.rows,
        columns: series.columns,
      });
      
      if (series.slices.length === 0) {
        throw new Error("Cannot build volume from empty series");
      }
      
      // Note: In DICOM, rows = height (Y), columns = width (X)
      const width = series.columns;  // X dimension
      const height = series.rows;   // Y dimension
      const depth = series.totalSlices; // Z dimension
      
      console.log("[MRI Store] Volume dimensions:", {
        width,
        height,
        depth,
        seriesRows: series.rows,
        seriesColumns: series.columns,
      });
      
      // Determine if we need Int16Array or Float32Array based on bits allocated
      const firstSlice = series.slices[0];
      const bitsAllocated = firstSlice.pixelData instanceof Uint16Array ? 16 : 8;
      const useFloat = bitsAllocated === 16; // Use Float32Array for 16-bit to handle rescale
      
      const totalVoxels = width * height * depth;
      const voxels = useFloat 
        ? new Float32Array(totalVoxels)
        : new Int16Array(totalVoxels);
      
      let globalMin = Infinity;
      let globalMax = -Infinity;
      
      // Fill volume slice by slice
      series.slices.forEach((slice, sliceIndex) => {
        if (!slice.pixelData) {
          console.warn(`[MRI Store] Slice ${sliceIndex} has no pixel data, skipping`);
          return;
        }
        
        const sliceData = slice.pixelData;
        const rescaleSlope = slice.rescaleSlope ?? 1;
        const rescaleIntercept = slice.rescaleIntercept ?? 0;
        
        console.log(`[MRI Store] Processing slice ${sliceIndex}:`, {
          pixelDataLength: sliceData.length,
          expectedPixels: width * height,
          rescaleSlope,
          rescaleIntercept,
        });
        
        // Validate pixel data length
        const expectedPixels = width * height;
        if (sliceData.length < expectedPixels) {
          console.warn(`[MRI Store] Slice ${sliceIndex} has insufficient pixel data: ${sliceData.length} < ${expectedPixels}`);
        }
        
        // Apply rescale if needed
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixelIndex = y * width + x;
            
            // Clamp pixel index to available data
            if (pixelIndex >= sliceData.length) {
              console.warn(`[MRI Store] Pixel index ${pixelIndex} out of bounds for slice ${sliceIndex}`);
              continue;
            }
            
            let intensity: number;
            
            if (sliceData instanceof Uint16Array) {
              intensity = sliceData[pixelIndex];
            } else if (sliceData instanceof Uint8Array) {
              intensity = sliceData[pixelIndex];
            } else {
              intensity = 0;
            }
            
            // Apply rescale: HU = pixel * slope + intercept
            const huValue = intensity * rescaleSlope + rescaleIntercept;
            
            // Store in volume (z = sliceIndex)
            const volumeIndex = x + y * width + sliceIndex * width * height;
            voxels[volumeIndex] = huValue;
            
            globalMin = Math.min(globalMin, huValue);
            globalMax = Math.max(globalMax, huValue);
          }
        }
      });
      
      console.log("[MRI Store] ✅ DICOM volume built:", {
        dimensions: `${width}×${height}×${depth}`,
        totalVoxels,
        min: globalMin,
        max: globalMax,
        pixelSpacing: series.pixelSpacing,
      });
      
      return {
        width,
        height,
        depth,
        voxels,
        min: globalMin,
        max: globalMax,
        pixelSpacing: series.pixelSpacing,
        sliceThickness: series.sliceThickness,
        spacingBetweenSlices: series.spacingBetweenSlices,
      };
    },
    
    setDicomSeries: (series: DICOMSeries) => {
      console.log("[MRI Store] setDicomSeries called");
      try {
        const volume = get().buildDicomVolume(series);
        set({
          dicomSeries: series,
          dicomVolume: volume,
          // Inicialmente usar o mesmo volume como A e B até termos T1/T2 distintos
          dicomVolumeA: volume,
          dicomVolumeB: volume,
          dicomReady: true,
          dicomError: null,
        });
        console.log("[MRI Store] ✅ DICOM series and volume set successfully");
      } catch (error: any) {
        const errorMessage = error.message || "Failed to build DICOM volume";
        console.error("[MRI Store] ❌ Error setting DICOM series:", error);
        set({
          dicomSeries: null,
          dicomVolume: null,
          dicomReady: false,
          dicomError: errorMessage,
        });
      }
    },
    
    setNIfTIVolume: (volume: DICOMVolume, _metadata?: any) => {
      console.log("[MRI Store] setNIfTIVolume called");
      try {
        set({
          dicomSeries: null, // NIfTI doesn't use DICOM series
          dicomVolume: volume,
          dicomVolumeA: volume,
          dicomVolumeB: volume,
          dicomReady: true,
          dicomError: null,
        });
        console.log("[MRI Store] ✅ NIfTI volume set:", {
          dimensions: `${volume.width}×${volume.height}×${volume.depth}`,
          min: volume.min,
          max: volume.max,
        });
      } catch (error: any) {
        console.error("[MRI Store] ❌ Error setting NIfTI volume:", error);
        set({
          dicomVolume: null,
          dicomReady: false,
          dicomError: error.message || "Failed to set NIfTI volume",
        });
      }
    },
    
    // Novo sistema unificado
    loadVolumeFromFiles: async (files: File[], onProgress?: (progress: number) => void) => {
      console.log('[MRI Store] loadVolumeFromFiles called with', files.length, 'files');
      set({ isLoadingVolume: true, volumeLoadError: null });
      
      try {
        // Calcular progresso durante o carregamento
        let totalBytes = 0;
        let loadedBytes = 0;
        
        // Calcular tamanho total
        files.forEach(file => {
          totalBytes += file.size;
        });
        
        // Ler arquivos com progresso
        const fileReaders: Promise<any>[] = [];
        files.forEach((file) => {
          const reader = new FileReader();
          const promise = new Promise((resolve, reject) => {
            reader.onload = (e) => {
              loadedBytes += file.size;
              if (onProgress) {
                const progress = Math.min(95, Math.round((loadedBytes / totalBytes) * 90)); // 90% para leitura, 10% para processamento
                onProgress(progress);
              }
              resolve(e.target?.result);
            };
            reader.onerror = reject;
            reader.onprogress = (e) => {
              if (e.lengthComputable && onProgress) {
                const fileProgress = (e.loaded / e.total) * (file.size / totalBytes) * 90;
                const overallProgress = Math.min(95, Math.round((loadedBytes / totalBytes) * 90 + fileProgress));
                onProgress(overallProgress);
              }
            };
          });
          reader.readAsArrayBuffer(file);
          fileReaders.push(promise);
        });
        
        // Aguardar todos os arquivos serem lidos
        await Promise.all(fileReaders);
        
        if (onProgress) {
          onProgress(95); // 95% após leitura completa
        }
        
        const parsedVolume = await loadVolume(files);
        
        if (onProgress) {
          onProgress(100); // 100% após processamento completo
        }
        
        console.log('[MRI Store] ✅ Volume carregado e normalizado:', {
          dimensions: `${parsedVolume.volume.width}×${parsedVolume.volume.height}×${parsedVolume.volume.depth}`,
          source: parsedVolume.volume.source,
          isValid: parsedVolume.volume.isValid,
        });
        
        const origTR = typeof parsedVolume.metadata?.tr === "number" ? parsedVolume.metadata.tr : 500;
        const origTE = typeof parsedVolume.metadata?.te === "number" ? parsedVolume.metadata.te : 15;

        set({
          normalizedVolume: parsedVolume.volume,
          volumeLoadError: null,
          isLoadingVolume: false,
          dicomReady: parsedVolume.volume.isValid,
          dicomError: null,
          realVolumeTR: origTR,
          realVolumeTE: origTE,
        });
      } catch (error: any) {
        const errorMessage = error.message || 'Erro desconhecido ao carregar volume';
        console.error('[MRI Store] ❌ Erro ao carregar volume:', error);
        
        set({
          normalizedVolume: null,
          volumeLoadError: errorMessage,
          isLoadingVolume: false,
          dicomReady: false,
          dicomError: errorMessage,
        });
        
        throw error; // Re-throw para que o UI possa mostrar o erro
      }
    },
    
    setNormalizedVolume: (volume: NormalizedVolume) => {
      console.log('[MRI Store] setNormalizedVolume called');
      set({
        normalizedVolume: volume,
        volumeLoadError: null,
        dicomReady: volume.isValid,
        dicomError: null,
      });
    },
    
    clearVolume: () => {
      console.log('[MRI Store] clearVolume called');
      set({
        normalizedVolume: null,
        volumeLoadError: null,
        isLoadingVolume: false,
        dicomReady: false,
        dicomError: null,
        dicomSeries: null,
        dicomVolume: null,
        dicomVolumeA: null,
        dicomVolumeB: null,
        segmentationVolume: null,
        currentCaseId: null,
        caseMetadataA: null,
        caseMetadataB: null,
      });
    },

    getBlendFactor: () => {
      const { config } = get();
      const te = config.te;
      const tr = config.tr;
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      // TE: mais longo -> mais T2 (blend alto). [15, 120] ms -> [0, 1]
      const teMin = 15;
      const teMax = 120;
      const teFactor = (te - teMin) / (teMax - teMin);
      // TR: mais longo -> mais T2. [400, 3500] ms -> [0, 1]
      const trMin = 400;
      const trMax = 3500;
      const trFactor = (tr - trMin) / (trMax - trMin);
      const blend = 0.65 * clamp01(teFactor) + 0.35 * clamp01(trFactor);
      return clamp01(blend);
    },

    syncSlices: (newIndex: number) => {
      const state = get();
      const depth =
        state.dicomVolumeA?.depth ??
        state.dicomVolume?.depth ??
        state.volume?.depth ??
        1;

      const maxIndex = Math.max(0, depth - 1);
      const clamped = Math.max(0, Math.min(maxIndex, newIndex));

      const currentConfig = state.config;
      if (currentConfig.sliceIndex === clamped) return;

      set({
        config: { ...currentConfig, sliceIndex: clamped },
      });
    },

    setActiveSequence: (seq: "t1" | "t2" | "flair" | "t1ce") => {
      const state = get();
      if (state.activeSequence === seq) return;
      set({ activeSequence: seq });
    },

    setMprRotations: (rot: { axial?: number; sagittal?: number; coronal?: number }) => {
      const state = get();
      set({
        mprAxialRotation:
          rot.axial != null ? rot.axial : state.mprAxialRotation ?? 0,
        mprSagittalRotation:
          rot.sagittal != null ? rot.sagittal : state.mprSagittalRotation ?? 0,
        mprCoronalRotation:
          rot.coronal != null ? rot.coronal : state.mprCoronalRotation ?? 0,
      });
    },

    loadClinicalCase: async (caseId: string) => {
      console.log("[MRI Store] loadClinicalCase called with", caseId);
      const state = get();
      if (state.loadingCase) {
        console.log("[MRI Store] loadClinicalCase: already loading, skipping");
        return;
      }

      // Forçar módulo clínico habilitado ao carregar um caso
      set((prev) => ({
        config: {
          ...prev.config,
          enabledModules: {
            ...prev.config.enabledModules,
            clinicalImage: true,
          },
        },
        loadingCase: true,
        caseError: null,
        currentCaseId: caseId,
      }));

      try {
        let t1Url: string | null = null;
        let t2Url: string | null = null;
        let flairUrl: string | null = null;
        let t1ceUrl: string | null = null;
        let segUrl: string | null = null;

        switch (caseId) {
          case "case01_brain":
          case "case01_brain_normal":
            t1Url = "/assets/cases/001/BraTS20_Training_001_t1.nii";
            t2Url = "/assets/cases/001/BraTS20_Training_001_t2.nii";
            flairUrl = "/assets/cases/001/BraTS20_Training_001_flair.nii";
            t1ceUrl = "/assets/cases/001/BraTS20_Training_001_t1ce.nii";
            // Máscara de segmentação BraTS (tumor)
            segUrl = "/assets/cases/001/BraTS20_Training_001_seg.nii";
            break;
          default:
            throw new Error(`Caso clínico desconhecido: ${caseId}`);
        }

        if (!t1Url || !t2Url) {
          throw new Error("URLs de T1/T2 não configuradas para este caso clínico");
        }

        const fetchAsFile = async (url: string, name: string): Promise<File> => {
          console.log("[MRI Store] Baixando NIfTI de:", url);
          const res = await fetch(url);
          if (!res.ok) {
            console.error("[MRI Store] Falha ao buscar arquivo:", url, res.status, res.statusText);
            throw new Error(`Falha ao carregar arquivo ${name} (${url}): ${res.status}`);
          }
          const buf = await res.arrayBuffer();
          return new File([buf], name);
        };

        // Carregar T1 e T2 (obrigatórios)
        const [fileT1, fileT2] = await Promise.all([
          fetchAsFile(t1Url, "brain_t1.nii"),
          fetchAsFile(t2Url, "brain_t2.nii"),
        ]);

        const [parsedT1, parsedT2] = await Promise.all([
          loadVolume([fileT1]),
          loadVolume([fileT2]),
        ]);

        // Volumes adicionais (FLAIR, T1ce) - opcionais
        let parsedFlair: ParsedVolume | null = null;
        let parsedT1ce: ParsedVolume | null = null;
        if (flairUrl) {
          try {
            const fileFlair = await fetchAsFile(flairUrl, "brain_flair.nii");
            parsedFlair = await loadVolume([fileFlair]);
          } catch (flairErr: any) {
            console.warn("[MRI Store] FLAIR não carregado:", flairErr?.message ?? flairErr);
          }
        }
        if (t1ceUrl) {
          try {
            const fileT1ce = await fetchAsFile(t1ceUrl, "brain_t1ce.nii");
            parsedT1ce = await loadVolume([fileT1ce]);
          } catch (t1ceErr: any) {
            console.warn("[MRI Store] T1ce não carregado:", t1ceErr?.message ?? t1ceErr);
          }
        }

        // Segmentação opcional: se falhar (ex.: formato diferente), continuamos sem overlay
        let parsedSeg: ParsedVolume | null = null;
        if (segUrl) {
          try {
            const fileSeg = await fetchAsFile(segUrl, "brain_seg.nii");
            parsedSeg = await loadVolume([fileSeg]);
          } catch (segErr: any) {
            console.warn("[MRI Store] Segmentação não carregada (overlay desativado):", segErr?.message ?? segErr);
          }
        }

        const volNormA = parsedT1.volume;
        const volNormB = parsedT2.volume;

        const volT1: DICOMVolume = {
          width: volNormA.width,
          height: volNormA.height,
          depth: volNormA.depth,
          voxels: volNormA.data,
          min: volNormA.min,
          max: volNormA.max,
          pixelSpacing: [volNormA.spacing[0], volNormA.spacing[1]],
          sliceThickness: volNormA.spacing[2],
          spacingBetweenSlices: volNormA.spacing[2],
        };

        const volT2: DICOMVolume = {
          width: volNormB.width,
          height: volNormB.height,
          depth: volNormB.depth,
          voxels: volNormB.data,
          min: volNormB.min,
          max: volNormB.max,
          pixelSpacing: [volNormB.spacing[0], volNormB.spacing[1]],
          sliceThickness: volNormB.spacing[2],
          spacingBetweenSlices: volNormB.spacing[2],
        };

        // Volume de segmentação (opcional, mas altamente recomendado para casos BraTS)
        let segVolume: DICOMVolume | null = null;
        if (parsedSeg) {
          const volSeg = parsedSeg.volume;
          segVolume = {
            width: volSeg.width,
            height: volSeg.height,
            depth: volSeg.depth,
            voxels: volSeg.data,
            min: volSeg.min,
            max: volSeg.max,
            pixelSpacing: [volSeg.spacing[0], volSeg.spacing[1]],
            sliceThickness: volSeg.spacing[2],
            spacingBetweenSlices: volSeg.spacing[2],
          };
        }

        // Volumes clínicos adicionais (se carregados e com mesma geometria)
        let volFlair: DICOMVolume | null = null;
        if (parsedFlair) {
          const v = parsedFlair.volume;
          if (v.width === volNormA.width && v.height === volNormA.height && v.depth === volNormA.depth) {
            volFlair = {
              width: v.width,
              height: v.height,
              depth: v.depth,
              voxels: v.data,
              min: v.min,
              max: v.max,
              pixelSpacing: [v.spacing[0], v.spacing[1]],
              sliceThickness: v.spacing[2],
              spacingBetweenSlices: v.spacing[2],
            };
          } else {
            console.warn("[MRI Store] FLAIR geometry mismatch; ignorando volume FLAIR.");
          }
        }

        let volT1ce: DICOMVolume | null = null;
        if (parsedT1ce) {
          const v = parsedT1ce.volume;
          if (v.width === volNormA.width && v.height === volNormA.height && v.depth === volNormA.depth) {
            volT1ce = {
              width: v.width,
              height: v.height,
              depth: v.depth,
              voxels: v.data,
              min: v.min,
              max: v.max,
              pixelSpacing: [v.spacing[0], v.spacing[1]],
              sliceThickness: v.spacing[2],
              spacingBetweenSlices: v.spacing[2],
            };
          } else {
            console.warn("[MRI Store] T1ce geometry mismatch; ignorando volume T1ce.");
          }
        }

        // Validação simples de geometria
        if (
          volT1.width !== volT2.width ||
          volT1.height !== volT2.height ||
          volT1.depth !== volT2.depth
        ) {
          console.error("[MRI Store] Clinical case geometry mismatch between T1 and T2", {
            t1: { w: volT1.width, h: volT1.height, d: volT1.depth },
            t2: { w: volT2.width, h: volT2.height, d: volT2.depth },
          });
          set({
            loadingCase: false,
            caseError:
              "Erro: As séries T1 e T2 do caso selecionado possuem geometrias incompatíveis para fusão.",
          });
          return;
        }

        const middleSlice = volT1.depth > 0 ? Math.floor(volT1.depth / 2) : 0;

        set({
          dicomVolume: volT1,
          dicomVolumeA: volT1,
          dicomVolumeB: volT2,
          dicomVolumeFlair: volFlair,
          dicomVolumeT1ce: volT1ce,
          segmentationVolume: segVolume,
          dicomReady: true,
          dicomError: null,
          loadingCase: false,
          caseError: null,
          // limpar volumes normalizados genéricos para evitar conflitos
          normalizedVolume: null,
          dicomSeries: null,
          caseMetadataA: parsedT1.metadata ?? null,
          caseMetadataB: parsedT2.metadata ?? null,
          realVolumeTR: parsedT1.metadata?.tr,
          realVolumeTE: parsedT1.metadata?.te,
          config: {
            ...get().config,
            sliceIndex: middleSlice,
          },
        });

        console.log("[MRI Store] ✅ Clinical case loaded successfully:", {
          caseId,
          dims: `${volT1.width}×${volT1.height}×${volT1.depth}`,
        });
      } catch (error: any) {
        console.error("[MRI Store] ❌ Error loading clinical case:", error);

        // Fallback inteligente: se já houver um volume carregado, usar como A e criar B sintético (inversão)
        try {
          const state = get();
          let baseVolume: DICOMVolume | null = state.dicomVolume;

          if (!baseVolume && state.normalizedVolume) {
            const vol = state.normalizedVolume;
            baseVolume = {
              width: vol.width,
              height: vol.height,
              depth: vol.depth,
              voxels: vol.data,
              min: vol.min,
              max: vol.max,
              pixelSpacing: [vol.spacing[0], vol.spacing[1]],
              sliceThickness: vol.spacing[2],
              spacingBetweenSlices: vol.spacing[2],
            };
          }

          if (baseVolume) {
            const { width, height, depth, voxels, max } = baseVolume;
            const total = width * height * depth;
            const synthetic = new Float32Array(total);
            const maxVal = typeof max === "number" ? max : 0;

            for (let i = 0; i < total; i++) {
              synthetic[i] = maxVal - voxels[i];
            }

            const volB: DICOMVolume = {
              width,
              height,
              depth,
              voxels: synthetic,
              min: -baseVolume.max,
              max: maxVal,
              pixelSpacing: baseVolume.pixelSpacing,
              sliceThickness: baseVolume.sliceThickness,
              spacingBetweenSlices: baseVolume.spacingBetweenSlices,
            };

            const middleSlice = depth > 0 ? Math.floor(depth / 2) : 0;

            set({
              dicomVolume: baseVolume,
              dicomVolumeA: baseVolume,
              dicomVolumeB: volB,
              dicomReady: true,
              dicomError: null,
              loadingCase: false,
              caseError: null,
              config: {
                ...state.config,
                sliceIndex: middleSlice,
              },
            });

            console.log("[MRI Store] ✅ Clinical case fallback: synthetic T2 created from base volume");
            return;
          }
        } catch (fallbackError) {
          console.error("[MRI Store] ❌ Error in clinical case fallback:", fallbackError);
        }

        set({
          loadingCase: false,
          caseError:
            error.message ||
            "Erro desconhecido ao carregar caso clínico. Verifique os arquivos T1/T2.",
        });
      }
    },
  } as MRILabStore;
});

// Export store instance ID for debugging
export const MRI_STORE_INSTANCE_ID = STORE_INSTANCE_ID;
