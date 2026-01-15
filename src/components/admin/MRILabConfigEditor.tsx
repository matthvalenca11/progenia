/**
 * MRI Lab Config Editor
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MRILabConfig, MRIPreset, MRIViewerType, MRIDataSource, MRIModule } from "@/types/mriLabConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { Button } from "@/components/ui/button";
import { parseDICOMFile, sortDICOMSlices, buildDICOMSeries } from "@/lib/dicomParser";
import { parseNIfTIFile, buildNIfTIVolume } from "@/lib/niftiParser";
import { toast } from "sonner";
import { Loader2, Upload, FileText, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useMRILabStore } from "@/stores/mriLabStore";
import { VolumeStatusPanel } from "./VolumeStatusPanel";

interface MRILabConfigEditorProps {
  config: MRILabConfig;
  onChange: (config: MRILabConfig) => void;
}

export function MRILabConfigEditor({ config, onChange }: MRILabConfigEditorProps) {
  const [isLoadingDICOM, setIsLoadingDICOM] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dicomFiles, setDicomFiles] = useState<File[]>([]);
  const { setDicomSeries, setNIfTIVolume, loadVolumeFromFiles, clearVolume } = useMRILabStore();

  const updateConfig = (updates: Partial<MRILabConfig>) => {
    onChange({ ...config, ...updates });
  };

  const handleDICOMUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsLoadingDICOM(true);
    setUploadProgress(0);
    try {
      console.log("[MRILabConfigEditor] Starting DICOM upload (new system), files:", files.length);
      
      // Calcular progresso durante o upload
      let processedFiles = 0;
      const totalFiles = files.length;
      
      // Usar novo sistema unificado com callback de progresso
      await loadVolumeFromFiles(files, (progress) => {
        setUploadProgress(progress);
      });
      
      // Atualizar config
      updateConfig({
        dataSource: "dicom",
        enabledModules: {
          ...config.enabledModules,
          clinicalImage: true,
        },
        activeViewer: "slice_2d",
      });

      setDicomFiles(files);
      toast.success(`Volume DICOM carregado: ${files.length} arquivo(s)`);
    } catch (error: any) {
      console.error("[MRILabConfigEditor] ❌ Error loading DICOM volume:", error);
      toast.error("Erro ao carregar volume DICOM", {
        description: error.message || "Verifique se os arquivos são DICOM válidos",
      });
    } finally {
      setIsLoadingDICOM(false);
      setUploadProgress(0);
    }
  };

  const handleNIfTIUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsLoadingDICOM(true);
    setUploadProgress(0);
    try {
      console.log("[MRILabConfigEditor] Starting NIfTI upload (new system), file:", files[0].name);
      
      // Usar novo sistema unificado com callback de progresso
      await loadVolumeFromFiles(files, (progress) => {
        setUploadProgress(progress);
      });

      // Update config
      updateConfig({
        dataSource: "nifti",
        enabledModules: {
          ...config.enabledModules,
          clinicalImage: true,
        },
        activeViewer: "slice_2d",
        viewer2DMode: "canvas",
        viewer3DMode: "mpr",
      });

      toast.success(`Arquivo NIfTI carregado`);
    } catch (error: any) {
      console.error("[MRILabConfigEditor] ❌ Error loading NIfTI file:", error);
      toast.error("Erro ao carregar arquivo NIfTI", {
        description: error.message || "Verifique se o arquivo é NIfTI válido",
      });
    } finally {
      setIsLoadingDICOM(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do Lab de MRI</CardTitle>
        <CardDescription>
          Configure os parâmetros de aquisição e visualização do simulador de ressonância magnética
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Data Source Mode */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Fonte de Dados</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="dataSource-phantom"
                name="dataSource"
                checked={config.dataSource === "phantom"}
                onChange={() => updateConfig({ dataSource: "phantom" })}
                className="h-4 w-4"
              />
              <Label htmlFor="dataSource-phantom" className="cursor-pointer">
                Phantom (Procedural)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="dataSource-dicom"
                name="dataSource"
                checked={config.dataSource === "dicom"}
                onChange={() => updateConfig({ dataSource: "dicom" })}
                className="h-4 w-4"
              />
              <Label htmlFor="dataSource-dicom" className="cursor-pointer">
                Série DICOM (Real)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="dataSource-nifti"
                name="dataSource"
                checked={config.dataSource === "nifti"}
                onChange={() => updateConfig({ dataSource: "nifti" })}
                className="h-4 w-4"
              />
              <Label htmlFor="dataSource-nifti" className="cursor-pointer">
                Arquivo NIfTI (.nii / .nii.gz)
              </Label>
            </div>
          </div>
        </div>

        {/* Enabled Modules */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Módulos Habilitados</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-magnetization" className="text-sm font-normal cursor-pointer">
                Módulo Magnetização (Física/Conceitual)
              </Label>
              <Switch
                id="enable-magnetization"
                checked={config.enabledModules.magnetization}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledModules: { ...config.enabledModules, magnetization: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-clinical" className="text-sm font-normal cursor-pointer">
                Módulo Imagem Clínica (DICOM)
              </Label>
              <Switch
                id="enable-clinical"
                checked={config.enabledModules.clinicalImage}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledModules: { ...config.enabledModules, clinicalImage: checked },
                  })
                }
                disabled={config.dataSource === "phantom"}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border my-4" />

        {/* File Upload Section - DICOM e NIfTI */}
        {(config.dataSource === "dicom" || config.dataSource === "nifti") && (
          <div className="space-y-4">
            <Label className="text-sm font-semibold">
              {config.dataSource === "dicom" ? "Carregar Série DICOM" : "Carregar Arquivo NIfTI"}
            </Label>
            <FileUploadField
              accept={config.dataSource === "dicom" ? ".dcm" : ".nii,.nii.gz"}
              multiple={config.dataSource === "dicom"}
              maxSize={500} // 500MB per file
              onFilesSelected={config.dataSource === "dicom" ? handleDICOMUpload : handleNIfTIUpload}
              disabled={isLoadingDICOM}
              label={
                config.dataSource === "dicom"
                  ? "Selecione ou arraste arquivos DICOM (.dcm)"
                  : "Selecione ou arraste arquivo NIfTI (.nii ou .nii.gz)"
              }
              description={
                config.dataSource === "dicom"
                  ? "Selecione múltiplos arquivos DICOM da mesma série. O sistema detectará automaticamente."
                  : "Selecione um único arquivo NIfTI (.nii ou .nii.gz comprimido)."
              }
            />
            
            {isLoadingDICOM && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {config.dataSource === "dicom"
                      ? "Processando arquivos DICOM..."
                      : "Processando arquivo NIfTI..."}
                  </span>
                </div>
                {uploadProgress > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
            )}

            {/* Volume Status Panel */}
            <VolumeStatusPanel />

            {/* DICOM Metadata Display */}
            {config.dicomSeries && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Série DICOM Carregada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Modalidade:</span>
                      <span className="ml-2 font-medium">{config.dicomSeries.modality}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Descrição:</span>
                      <span className="ml-2 font-medium">{config.dicomSeries.seriesDescription}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fatias:</span>
                      <span className="ml-2 font-medium">{config.dicomSeries.totalSlices}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dimensões:</span>
                      <span className="ml-2 font-medium">
                        {config.dicomSeries.columns} × {config.dicomSeries.rows}
                      </span>
                    </div>
                    {config.dicomSeries.pixelSpacing && (
                      <div>
                        <span className="text-muted-foreground">Pixel Spacing:</span>
                        <span className="ml-2 font-medium">
                          {config.dicomSeries.pixelSpacing[0].toFixed(2)} × {config.dicomSeries.pixelSpacing[1].toFixed(2)} mm
                        </span>
                      </div>
                    )}
                    {config.dicomSeries.sliceThickness && (
                      <div>
                        <span className="text-muted-foreground">Espessura:</span>
                        <span className="ml-2 font-medium">{config.dicomSeries.sliceThickness} mm</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="border-t border-border my-4" />

        {/* Viewer Mode Selection (for DICOM) */}
        {config.dataSource === "dicom" && (
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Modo dos Viewers</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Viewer 2D</Label>
                <Select
                  value={config.viewer2DMode || "cornerstone"}
                  onValueChange={(v) => updateConfig({ viewer2DMode: v as "cornerstone" | "canvas" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cornerstone">Cornerstone3D (PACS-like)</SelectItem>
                    <SelectItem value="canvas">Canvas (Compatibilidade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Viewer 3D</Label>
                <Select
                  value={config.viewer3DMode || "mpr"}
                  onValueChange={(v) => updateConfig({ viewer3DMode: v as "mpr" | "volume" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpr">MPR (3 Planos)</SelectItem>
                    <SelectItem value="volume">Volume Rendering (vtk.js)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-border my-4" />

        {/* Phantom Mode Configuration */}
        {config.dataSource === "phantom" && (
          <>
            {/* Presets */}
        <div className="space-y-2">
          <Label>Preset Padrão</Label>
          <Select
            value={config.preset}
            onValueChange={(v) => updateConfig({ preset: v as MRIPreset })}
            disabled={!config.enabledControls.preset}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="t1_weighted">T1-weighted</SelectItem>
              <SelectItem value="t2_weighted">T2-weighted</SelectItem>
              <SelectItem value="proton_density">Proton Density</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Acquisition Parameters */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Parâmetros de Aquisição</Label>

          {config.enabledControls.tr && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>TR (Repetition Time)</Label>
                <span className="text-sm text-muted-foreground">
                  {config.tr} ms
                </span>
              </div>
              <Slider
                value={[config.tr]}
                onValueChange={(v) => updateConfig({ tr: v[0] })}
                min={config.ranges.tr.min}
                max={config.ranges.tr.max}
                step={10}
              />
            </div>
          )}

          {config.enabledControls.te && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>TE (Echo Time)</Label>
                <span className="text-sm text-muted-foreground">
                  {config.te} ms
                </span>
              </div>
              <Slider
                value={[config.te]}
                onValueChange={(v) => updateConfig({ te: v[0] })}
                min={config.ranges.te.min}
                max={config.ranges.te.max}
                step={1}
              />
            </div>
          )}

          {config.enabledControls.flipAngle && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Flip Angle</Label>
                <span className="text-sm text-muted-foreground">
                  {config.flipAngle}°
                </span>
              </div>
              <Slider
                value={[config.flipAngle]}
                onValueChange={(v) => updateConfig({ flipAngle: v[0] })}
                min={config.ranges.flipAngle.min}
                max={config.ranges.flipAngle.max}
                step={5}
              />
            </div>
          )}

          {config.enabledControls.sequenceType && (
            <div className="space-y-2">
              <Label>Tipo de Sequência</Label>
              <Select
                value={config.sequenceType}
                onValueChange={(v) => updateConfig({ sequenceType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spin_echo">Spin Echo</SelectItem>
                  <SelectItem value="gradient_echo">Gradient Echo</SelectItem>
                  <SelectItem value="inversion_recovery">Inversion Recovery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Viewer Selection */}
        {config.enabledControls.viewer && (
          <div className="space-y-2">
            <Label>Visualização Padrão</Label>
            <Select
              value={config.activeViewer}
              onValueChange={(v) => updateConfig({ activeViewer: v as MRIViewerType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="magnetization">Magnetização 3D</SelectItem>
                <SelectItem value="slice_2d">Fatia 2D</SelectItem>
                <SelectItem value="volume_3d">Volume 3D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Enabled Controls */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Controles Habilitados</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-preset" className="text-sm font-normal">
                Preset
              </Label>
              <Switch
                id="enable-preset"
                checked={config.enabledControls.preset}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, preset: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-tr" className="text-sm font-normal">
                TR
              </Label>
              <Switch
                id="enable-tr"
                checked={config.enabledControls.tr}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, tr: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-te" className="text-sm font-normal">
                TE
              </Label>
              <Switch
                id="enable-te"
                checked={config.enabledControls.te}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, te: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-flip" className="text-sm font-normal">
                Flip Angle
              </Label>
              <Switch
                id="enable-flip"
                checked={config.enabledControls.flipAngle}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, flipAngle: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-sequence" className="text-sm font-normal">
                Tipo de Sequência
              </Label>
              <Switch
                id="enable-sequence"
                checked={config.enabledControls.sequenceType}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, sequenceType: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-viewer" className="text-sm font-normal">
                Seleção de Viewer
              </Label>
              <Switch
                id="enable-viewer"
                checked={config.enabledControls.viewer}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, viewer: checked },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Ranges */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Faixas de Valores</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">TR (ms)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <input
                    type="number"
                    value={config.ranges.tr.min}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          tr: { ...config.ranges.tr, min: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <input
                    type="number"
                    value={config.ranges.tr.max}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          tr: { ...config.ranges.tr, max: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">TE (ms)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <input
                    type="number"
                    value={config.ranges.te.min}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          te: { ...config.ranges.te, min: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <input
                    type="number"
                    value={config.ranges.te.max}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          te: { ...config.ranges.te, max: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Flip Angle (°)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <input
                    type="number"
                    value={config.ranges.flipAngle.min}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          flipAngle: { ...config.ranges.flipAngle, min: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <input
                    type="number"
                    value={config.ranges.flipAngle.max}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          flipAngle: { ...config.ranges.flipAngle, max: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
