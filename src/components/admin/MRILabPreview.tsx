/**
 * MRI Lab Preview - WYSIWYG Preview
 * Uses the same renderer as the student mode for accurate preview
 */

import React, { useEffect, useRef } from "react";
import { MRILabV2 } from "@/components/labs/mri/MRILabV2";
import { MRILabConfig, defaultMRILabConfig } from "@/types/mriLabConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Settings, Loader2 } from "lucide-react";
import { MRIErrorBoundary } from "./MRIErrorBoundary";
import { useMRILabStore } from "@/stores/mriLabStore";

interface MRILabPreviewProps {
  config?: MRILabConfig;
  previewMode?: "student" | "admin";
  onPreviewModeChange?: (mode: "student" | "admin") => void;
  onConfigChange?: (nextConfig: MRILabConfig) => void;
}

export function MRILabPreview({ 
  config, 
  previewMode = "student",
  onPreviewModeChange,
  onConfigChange,
}: MRILabPreviewProps) {
  const store = useMRILabStore();
  const { initIfNeeded, volumeReady, normalizedVolume, dicomReady, config: storeConfig, loadClinicalCase } = store;
  const storeInstanceId = store.storeInstanceId || "unknown";
  const initializedRef = useRef(false);
  
  // Use default config if not provided or invalid
  const validConfig = config && typeof config === 'object' && 'tr' in config 
    ? config 
    : defaultMRILabConfig;
  
  console.log("[MRILabPreview] Rendering preview with config:", {
    storeInstanceId,
    hasConfig: !!config,
    validConfig: !!validConfig,
    phantomType: validConfig.phantomType,
    tr: validConfig.tr,
    te: validConfig.te,
    volumeReady,
    normalizedVolume: !!normalizedVolume,
    normalizedVolumeValid: normalizedVolume?.isValid,
    dicomReady,
  });
  
  // CRITICAL: Initialize store on mount if needed
  useEffect(() => {
    console.log("[MRILabPreview] ✅ Component mounted");
    
    if (initializedRef.current) {
      console.log("[MRILabPreview] Já inicializado, ignorando nova chamada.");
      return;
    }

    // Sempre carregar caso clínico BraTS (nifti, dicom ou phantom legado)
    const useClinical = storeConfig.dataSource === "nifti" || storeConfig.dataSource === "dicom" || storeConfig.dataSource === "phantom";
    if (useClinical) {
      console.log("[MRILabPreview] Carregando caso clínico BraTS (case01_brain_normal). dataSource:", storeConfig.dataSource);
      void loadClinicalCase("case01_brain_normal");
      initializedRef.current = true;
      return;
    }

    // Se já temos volume normalizado válido, não precisa re-inicializar
    if (normalizedVolume && normalizedVolume.isValid) {
      console.log("[MRILabPreview] Volume normalizado já disponível, pulando initIfNeeded");
      initializedRef.current = true;
      return;
    }
    
    console.log("[MRILabPreview] Chamando initIfNeeded");
    initIfNeeded("MRILabPreview mount", validConfig);
    initializedRef.current = true;
  }, []); // Only on mount
  
  // MRILabV2 will handle updating the store when config prop changes
  // But we ensure initialization happens here too

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Preview ao Vivo</CardTitle>
            <CardDescription className="text-xs">
              Visualização idêntica ao que o aluno verá
            </CardDescription>
          </div>
          {onPreviewModeChange && (
            <div className="flex items-center gap-2">
              <Label htmlFor="preview-mode" className="text-xs text-muted-foreground flex items-center gap-1.5">
                {previewMode === "student" ? (
                  <>
                    <Eye className="h-3 w-3" />
                    Modo Aluno
                  </>
                ) : (
                  <>
                    <Settings className="h-3 w-3" />
                    Modo Admin
                  </>
                )}
              </Label>
              <Switch
                id="preview-mode"
                checked={previewMode === "admin"}
                onCheckedChange={(checked) => 
                  onPreviewModeChange(checked ? "admin" : "student")
                }
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        <div className="h-full w-full relative">
          <MRIErrorBoundary>
            {validConfig ? (
              <MRILabV2 
                config={validConfig} 
                showBackButton={false}
                labName="Preview"
                showDebug={previewMode === "admin"}
                onConfigChange={onConfigChange}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Carregando preview...</p>
                </div>
              </div>
            )}
          </MRIErrorBoundary>
          {/* Admin mode overlays (future: debug info, voxel stats, etc.) */}
          {previewMode === "admin" && (
            <div className="absolute top-2 right-2 z-50 bg-amber-500/20 border border-amber-500/40 rounded px-2 py-1 text-xs text-amber-400">
              Modo Admin - Debug
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
