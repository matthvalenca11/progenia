import { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

interface LabWrapperProps {
  children: ReactNode;
  videoUrl?: string;
  title?: string;
  showDisclaimer?: boolean;
}

/**
 * LabWrapper - Wraps all virtual labs with:
 * 1. Optional video display (uploaded via platform)
 * 2. Mandatory educational disclaimer
 */
export function LabWrapper({ 
  children, 
  videoUrl, 
  title,
  showDisclaimer = true 
}: LabWrapperProps) {
  return (
    <div className="w-full space-y-6">
      {/* Optional Video Section */}
      {videoUrl && (
        <div className="w-full rounded-lg overflow-hidden border border-border bg-card">
          <div className="aspect-video w-full">
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-contain bg-black"
              preload="metadata"
            >
              <source src={videoUrl} type="video/mp4" />
              <source src={videoUrl} type="video/webm" />
              Seu navegador não suporta a reprodução de vídeos.
            </video>
          </div>
          {title && (
            <div className="p-3 border-t border-border bg-muted/30">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Vídeo de apoio: {title}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Lab Content */}
      <div className="w-full">
        {children}
      </div>
      
      {/* Educational Disclaimer */}
      {showDisclaimer && (
        <div className="w-full mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Aviso Educacional
              </p>
              <p className="text-sm text-muted-foreground">
                Este laboratório virtual é uma ferramenta didática. 
                Os parâmetros utilizados não representam valores clínicos reais; 
                apenas os efeitos físicos são aproximados para fins educativos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
