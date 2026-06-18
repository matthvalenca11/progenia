import { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { EmbeddedVideo } from "@/components/EmbeddedVideo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LabWrapperProps {
  children: ReactNode;
  videoUrl?: string;
  title?: string;
  showDisclaimer?: boolean;
  immersive?: boolean;
}

/**
 * LabWrapper - Wraps all virtual labs with:
 * 1. Optional support video (YouTube link)
 * 2. Mandatory educational disclaimer
 */
export function LabWrapper({ 
  children, 
  videoUrl, 
  title,
  showDisclaimer = true,
  immersive = false,
}: LabWrapperProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const isMobile = useIsMobile();

  return (
    <div className={cn("layout-contained flex h-full min-h-0 w-full flex-col", immersive ? "" : "space-y-6")}>
      {/* Optional Video Section */}
      {videoUrl && !immersive && (
        <div className="w-full rounded-lg overflow-hidden border border-border bg-card">
          <EmbeddedVideo url={videoUrl} title={title ? `Vídeo de apoio: ${title}` : "Vídeo de apoio"} />
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
      <div className={cn("layout-contained w-full", immersive ? "flex min-h-0 flex-1 flex-col" : "")}>
        {children}
      </div>
      
      {/* Educational Disclaimer */}
      {showDisclaimer && !immersive &&
        (isMobile ? (
          <details className="w-full mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3" data-no-auto-translate="true">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {isEnglish ? "Educational Notice" : "Aviso Educacional"}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEnglish
                ? "This virtual laboratory is an educational tool. The parameters used do not represent real clinical values; only the physical effects are approximated for learning purposes."
                : "Este laboratório virtual é uma ferramenta didática. Os parâmetros utilizados não representam valores clínicos reais; apenas os efeitos físicos são aproximados para fins educativos."}
            </p>
          </details>
        ) : (
          <div className="w-full mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30" data-no-auto-translate="true">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {isEnglish ? "Educational Notice" : "Aviso Educacional"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isEnglish
                    ? "This virtual laboratory is an educational tool. The parameters used do not represent real clinical values; only the physical effects are approximated for learning purposes."
                    : "Este laboratório virtual é uma ferramenta didática. Os parâmetros utilizados não representam valores clínicos reais; apenas os efeitos físicos são aproximados para fins educativos."}
                </p>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
