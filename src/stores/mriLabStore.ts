/**
 * MRI Lab Store - Zustand store for MRI Lab state
 * CONTRATO FORTE: volumeReady === true significa volume válido disponível
 */

import { create } from "zustand";
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

interface MRILabStore {
  config: MRILabConfig;
  volume: VolumeMRI | null;
  volumeReady: boolean;
  simulationResult: MRISimulationResult | null;
  simulationError: string | null;
  isSimulating: boolean; // Flag to prevent recursive calls
  storeInstanceId: string; // Unique ID for debugging store duplication
  lastSimulatedConfigHash: string; // Hash of last config used for simulation
  lastSimulationAt: number | null; // Timestamp of last simulation
  
  // DICOM support (legacy - será removido gradualmente)
  dicomSeries: DICOMSeries | null;
  dicomVolume: DICOMVolume | null;
  dicomReady: boolean;
  dicomError: string | null;
  
  // Novo sistema unificado
  normalizedVolume: NormalizedVolume | null;
  volumeLoadError: string | null;
  isLoadingVolume: boolean;
  
  initIfNeeded: (reason: string, configOverride?: MRILabConfig) => void;
  setLabConfig: (config: MRILabConfig) => void;
  updateConfig: (updates: Partial<MRILabConfig>) => void;
  runSimulation: () => void;
  setDicomSeries: (series: DICOMSeries) => void;
  buildDicomVolume: (series: DICOMSeries) => DICOMVolume;
  setNIfTIVolume: (volume: DICOMVolume, metadata?: any) => void;
  
  // Novo sistema unificado
  loadVolumeFromFiles: (files: File[], onProgress?: (progress: number) => void) => Promise<void>;
  setNormalizedVolume: (volume: NormalizedVolume) => void;
  clearVolume: () => void;
}

// Generate unique store instance ID (singleton - created once)
const STORE_INSTANCE_ID = `mri-store-${Math.random().toString(16).slice(2)}-${Date.now()}`;
console.log(`[MRI Store] Creating store instance: ${STORE_INSTANCE_ID}`);

export const useMRILabStore = create<MRILabStore>((set, get) => {
  // Run initial simulation
  let initialVolume: VolumeMRI | null = null;
  let initialVolumeReady = false;
  let initialSimulationResult: MRISimulationResult | null = null;
  let initialSimulationError: string | null = null;
  let initialSliceIndex = 0;
  
  console.log("[MRI Store] Initializing store with default config");
  try {
    console.log("[MRI Store] Running initial simulation...");
    const result = simulateMRI(defaultMRILabConfig);
    console.log("[MRI Store] Initial simulation returned:", {
      hasResult: !!result,
      hasVolume: !!(result?.volume),
      volumeDims: result?.volume ? `${result.volume.width}x${result.volume.height}x${result.volume.depth}` : "N/A",
      voxelsLength: result?.volume?.voxels?.length || 0,
      expectedVoxels: result?.volume ? result.volume.width * result.volume.height * result.volume.depth : 0,
      sampleVoxel: result?.volume?.voxels?.[0] || null,
    });
    
    if (result && result.volume && result.volume.voxels && result.volume.voxels.length > 0) {
      // Additional validation
      const expectedVoxels = result.volume.width * result.volume.height * result.volume.depth;
      if (result.volume.voxels.length !== expectedVoxels) {
        throw new Error(`Initial volume voxel count mismatch: expected ${expectedVoxels}, got ${result.volume.voxels.length}`);
      }
      
      initialVolume = result.volume;
      initialVolumeReady = true;
      initialSimulationResult = result;
      if (result.volume.depth > 0) {
        initialSliceIndex = Math.floor(result.volume.depth / 2);
      }
      console.log("[MRI Store] ✅ Initial volume set successfully, volumeReady=true, sliceIndex=" + initialSliceIndex);
    } else {
      initialSimulationError = "Initial simulation returned invalid volume";
      console.error("[MRI Store] ❌ Initial simulation returned invalid volume:", {
        hasResult: !!result,
        hasVolume: !!(result?.volume),
        voxelsLength: result?.volume?.voxels?.length || 0,
      });
    }
  } catch (error: any) {
    initialSimulationError = error.message || "Failed to run initial simulation";
    console.error("[MRI Store] ❌ Error running initial simulation:", {
      message: error.message,
      stack: error.stack,
      error,
    });
  }
  
  // Helper to generate config hash
  const generateConfigHash = (cfg: MRILabConfig): string => {
    return `${cfg.phantomType}-${cfg.tr}-${cfg.te}-${cfg.flipAngle}-${cfg.preset}-${cfg.sequenceType}`;
  };
  
  // Build initial config with sliceIndex set
  const initialConfig = { ...defaultMRILabConfig, sliceIndex: initialSliceIndex };
  
  return {
    // State properties
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
    dicomReady: false,
    dicomError: null as string | null,
    normalizedVolume: null as NormalizedVolume | null,
    volumeLoadError: null as string | null,
    isLoadingVolume: false,
    
    // Methods
    initIfNeeded: (reason: string, configOverride?: MRILabConfig) => {
      const state = get();
      console.log(`[MRI Store] initIfNeeded called - reason: ${reason}, volumeReady: ${state.volumeReady}, isSimulating: ${state.isSimulating}`);
      
      // If already ready, check if config changed
      if (state.volumeReady && !configOverride) {
        const currentHash = generateConfigHash(state.config);
        if (currentHash === state.lastSimulatedConfigHash) {
          console.log(`[MRI Store] initIfNeeded: Volume already ready with same config, skipping`);
          return;
        }
      }
      
      // If simulating, skip
      if (state.isSimulating) {
        console.log(`[MRI Store] initIfNeeded: Already simulating, skipping`);
        return;
      }
      
      // Use override config if provided, otherwise use current config
      const configToUse = configOverride || state.config;
      
      // Update config if override provided
      if (configOverride) {
        console.log(`[MRI Store] initIfNeeded: Using config override`, {
          dataSource: configOverride.dataSource,
          hasDicomSeries: !!configOverride.dicomSeries,
          hasNiftiVolume: !!configOverride.niftiVolume,
        });
        set({ config: configToUse, simulationError: null, dicomError: null });
        
        // If DICOM series is provided in override, set it in store
        if (configOverride.dicomSeries && configOverride.dataSource === "dicom") {
          console.log("[MRI Store] initIfNeeded: DICOM series found in config override, setting in store");
          get().setDicomSeries(configOverride.dicomSeries);
        }
        
        // If NIfTI volume is provided in override, set it in store
        if (configOverride.niftiVolume && configOverride.dataSource === "nifti") {
          console.log("[MRI Store] initIfNeeded: NIfTI volume found in config override, setting in store");
          get().setNIfTIVolume(configOverride.niftiVolume);
        }
      }
      
      // Run simulation
      console.log(`[MRI Store] initIfNeeded: Running simulation with reason: ${reason}`);
      get().runSimulation();
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
      const state = get();
      
      // Prevent recursive calls
      if (state.isSimulating) {
        console.log("[MRI Store] ⚠️ runSimulation already in progress, skipping");
        return;
      }
      
      console.log("[MRI Store] runSimulation() called");
      
      // Set flag to prevent recursion
      set({ isSimulating: true });
      
      try {
        const config = get().config;
        console.log("[MRI Store] runSimulation start - config:", {
          phantomType: config.phantomType,
          tr: config.tr,
          te: config.te,
          flipAngle: config.flipAngle,
          preset: config.preset,
        });
        
        const result = simulateMRI(config);
        console.log("[MRI Store] simulateMRI returned:", {
          hasResult: !!result,
          hasVolume: !!(result?.volume),
          volumeDims: result?.volume ? `${result.volume.width}x${result.volume.height}x${result.volume.depth}` : "N/A",
          voxelsLength: result?.volume?.voxels?.length || 0,
          expectedVoxels: result?.volume ? result.volume.width * result.volume.height * result.volume.depth : 0,
          sampleVoxel: result?.volume?.voxels?.[0] || null,
        });
        
        // STRICT VALIDATION: volume must exist and have voxels
        if (!result || !result.volume) {
          throw new Error("simulateMRI returned null or undefined volume");
        }
        
        if (!result.volume.voxels || result.volume.voxels.length === 0) {
          throw new Error(`Volume has no voxels (dims: ${result.volume.width}x${result.volume.height}x${result.volume.depth})`);
        }
        
        if (result.volume.width <= 0 || result.volume.height <= 0 || result.volume.depth <= 0) {
          throw new Error(`Invalid volume dimensions: ${result.volume.width}x${result.volume.height}x${result.volume.depth}`);
        }
        
        const expectedVoxels = result.volume.width * result.volume.height * result.volume.depth;
        if (result.volume.voxels.length !== expectedVoxels) {
          throw new Error(`Voxel count mismatch: expected ${expectedVoxels}, got ${result.volume.voxels.length} (dims: ${result.volume.width}x${result.volume.height}x${result.volume.depth})`);
        }
        
        console.log("[MRI Store] ✅ All validations passed, setting volume + volumeReady=true");
        
        // Generate config hash for this simulation
        const configHash = generateConfigHash(config);
        
        // All validations passed - set volume
        // IMPORTANT: Set volumeReady FIRST, then volume, to avoid race conditions
        set({ 
          volume: result.volume,
          volumeReady: true,
          simulationResult: result,
          simulationError: null,
          lastSimulatedConfigHash: configHash,
          lastSimulationAt: Date.now(),
        });
        
        console.log("[MRI Store] ✅ State updated - volume set, volumeReady=true, configHash:", configHash);
        
        // Ensure sliceIndex is valid
        const currentConfig = get().config;
        const maxSlice = Math.max(0, result.volume.depth - 1);
        const currentSlice = currentConfig.sliceIndex || 0;
        
        if (currentSlice > maxSlice || currentSlice < 0) {
          // Set to middle slice if invalid
          const middleSlice = Math.floor(result.volume.depth / 2);
          set({ config: { ...currentConfig, sliceIndex: middleSlice } });
          console.log("[MRI Store] ✅ sliceIndex adjusted to middle:", middleSlice);
        }
        
        // Verify state was set correctly
        const verifyState = get();
        console.log("[MRI Store] ✅ Verification - final state:", {
          storeInstanceId: verifyState.storeInstanceId,
          volumeReady: verifyState.volumeReady,
          hasVolume: !!verifyState.volume,
          volumeDims: verifyState.volume ? `${verifyState.volume.width}×${verifyState.volume.height}×${verifyState.volume.depth}` : "null",
          voxelsLength: verifyState.volume?.voxels?.length || 0,
          configHash: verifyState.lastSimulatedConfigHash,
        });
      } catch (error: any) {
        const errorMessage = error.message || "Unknown error in runSimulation";
        console.error("[MRI Store] ❌ runSimulation error:", {
          message: errorMessage,
          stack: error.stack,
          error,
        });
        set({ 
          volume: null,
          volumeReady: false,
          simulationResult: null,
          simulationError: errorMessage,
          isSimulating: false // Reset flag on error
        });
      } finally {
        // Always reset flag when done
        set({ isSimulating: false });
      }
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
    
    setNIfTIVolume: (volume: DICOMVolume, metadata?: any) => {
      console.log("[MRI Store] setNIfTIVolume called");
      try {
        set({
          dicomSeries: null, // NIfTI doesn't use DICOM series
          dicomVolume: volume,
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
        files.forEach((file, index) => {
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
        
        set({
          normalizedVolume: parsedVolume.volume,
          volumeLoadError: null,
          isLoadingVolume: false,
          // Atualizar também o sistema legado para compatibilidade temporária
          dicomReady: parsedVolume.volume.isValid,
          dicomError: null,
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
      });
    },
  };
});

// Export store instance ID for debugging
export const MRI_STORE_INSTANCE_ID = STORE_INSTANCE_ID;
