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
import { AlertTriangle, Loader2, Upload, FileText, CheckCircle2 } from "lucide-react";
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Configuração do Lab de MRI</CardTitle>
            <CardDescription>
              Configure os parâmetros de aquisição e visualização do simulador de ressonância magnética
            </CardDescription>
          </div>
          {config.dataSource === "dicom" && (
            <div className="inline-flex items-center rounded-full border border-cyan-400/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-300">
              MODO: SIMULAÇÃO CLÍNICA (INTERPOLAÇÃO)
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Data Source Mode - focado em dados reais (DICOM/NIfTI) */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Fonte de Dados</Label>
          <div className="space-y-3">
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

        {/* Enabled Modules (magnetização em hold, apenas Imagem Clínica visível) */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Módulos Habilitados</Label>
          <div className="space-y-3">
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

            {config.dataSource === "dicom" && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-medium">Atenção:</span> Volumes carregados no preview ficam salvos apenas nesta sessão.
                    Para uso permanente, salve o caso clínico após o upload.
                  </div>
                </div>
              </div>
            )}

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
        )}

        <div className="border-t border-border my-4" />

        {/* Phantom Mode Configuration removida da UI principal (modo clínico é o foco) */}
      </CardContent>
    </Card>
  );
}
