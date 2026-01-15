/**
 * Volume Status Panel - Painel de status honesto do volume carregado
 */

import { useMRILabStore } from "@/stores/mriLabStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

export function VolumeStatusPanel() {
  const store = useMRILabStore();
  const { normalizedVolume, volumeLoadError, isLoadingVolume } = store;

  if (isLoadingVolume) {
    return (
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Carregando Volume...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Processando arquivos...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (volumeLoadError) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-500">
            <XCircle className="h-4 w-4" />
            Erro ao Carregar Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs font-mono bg-red-500/20 p-2 rounded">
            {volumeLoadError}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!normalizedVolume) {
    return (
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Nenhum Volume Carregado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Faça upload de arquivos DICOM ou NIfTI para começar.
          </div>
        </CardContent>
      </Card>
    );
  }

  const isValid = normalizedVolume.isValid;

  return (
    <Card className={isValid ? "bg-green-500/10 border-green-500/20" : "bg-amber-500/10 border-amber-500/20"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {isValid ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Volume Válido
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Volume com Problemas
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-muted-foreground">Fonte:</span>
            <Badge variant="outline" className="ml-2">
              {normalizedVolume.source}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={isValid ? "default" : "destructive"} className="ml-2">
              {isValid ? "Válido" : "Inválido"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Dimensões:</span>
            <span className="ml-2 font-medium">
              {normalizedVolume.width} × {normalizedVolume.height} × {normalizedVolume.depth}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Voxels:</span>
            <span className="ml-2 font-medium">
              {(normalizedVolume.width * normalizedVolume.height * normalizedVolume.depth).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Espaçamento:</span>
            <span className="ml-2 font-medium">
              {normalizedVolume.spacing[0].toFixed(2)} × {normalizedVolume.spacing[1].toFixed(2)} × {normalizedVolume.spacing[2].toFixed(2)} mm
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Orientação:</span>
            <Badge variant="outline" className="ml-2">
              {normalizedVolume.orientation}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Intensidade Min:</span>
            <span className="ml-2 font-medium">{normalizedVolume.min.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Intensidade Max:</span>
            <span className="ml-2 font-medium">{normalizedVolume.max.toFixed(2)}</span>
          </div>
        </div>

        {normalizedVolume.validationErrors && normalizedVolume.validationErrors.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs font-semibold text-amber-500 mb-1">Erros de Validação:</div>
            <ul className="text-xs font-mono bg-amber-500/20 p-2 rounded space-y-1">
              {normalizedVolume.validationErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
