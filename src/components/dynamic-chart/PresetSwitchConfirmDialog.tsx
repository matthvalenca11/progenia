import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPresetCatalogEntry } from "@/lib/dynamicChart/presets";
import { resolvePresetMetaField, type DynamicChartPresetId } from "@/types/dynamicChart";

export interface PresetSwitchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPresetId: DynamicChartPresetId | null;
  onConfirm: (preserveAxesAndFeedbacks: boolean) => void;
}

export function PresetSwitchConfirmDialog({
  open,
  onOpenChange,
  targetPresetId,
  onConfirm,
}: PresetSwitchConfirmDialogProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const targetMeta = targetPresetId ? getPresetCatalogEntry(targetPresetId) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEnglish ? "Switch model?" : "Trocar modelo?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {isEnglish
                  ? "Keep current axes and feedbacks, or reset them to the new model defaults?"
                  : "Manter eixos e feedbacks atuais ou usar os padrões do novo modelo?"}
              </p>
              {targetMeta && (
                <p className="font-medium text-foreground">
                  {resolvePresetMetaField(targetMeta.title, language)}
                </p>
              )}
              <p className="text-xs">
                {isEnglish
                  ? "Parameters always follow the new model."
                  : "Parâmetros sempre seguem o novo modelo."}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            className="w-full sm:w-full"
            onClick={() => onConfirm(false)}
          >
            {isEnglish ? "Reset axes and feedbacks" : "Redefinir eixos e feedbacks"}
          </AlertDialogAction>
          <AlertDialogAction
            className="w-full sm:w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
            onClick={() => onConfirm(true)}
          >
            {isEnglish ? "Keep axes and feedbacks" : "Manter eixos e feedbacks"}
          </AlertDialogAction>
          <AlertDialogCancel className="w-full sm:w-full mt-0">
            {isEnglish ? "Cancel" : "Cancelar"}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
