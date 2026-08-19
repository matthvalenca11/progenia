import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Camera, RotateCcw, Settings2, Smartphone } from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { isNativeApp } from "@/lib/capacitor";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "ar-slice:onboarding-v5-done";

type Step = {
  title: string;
  body: string;
  icon: typeof Camera;
};

function buildSteps(isEnglish: boolean): Step[] {
  return isEnglish
    ? [
        {
          icon: Smartphone,
          title: "1. Start with device sensors",
          body:
            "Device sensors start automatically. With the phone upright, the ring starts tilted 90° backward/downward (screen-down reference). Tilt the phone to aim the slice. To use a ProGenia frame instead, open Settings and select BLE frame under Motion source.",
        },
        {
          icon: Camera,
          title: "2. Turn on the camera",
          body:
            "Enable the camera to see the real world along with the slice. With your phone, hold it upright in front of you. With the frame, point the camera at it.",
        },
        {
          icon: RotateCcw,
          title: "3. Set your starting position",
          body:
            "When you're in the position you want, tap Zero orientation. That marks the reference point for the slices.",
        },
        {
          icon: Settings2,
          title: "4. Freeze and adjust",
          body:
            "Use the snowflake button to hold the slice still. The settings button beside it opens zoom, slice position and movement sensitivity.",
        },
      ]
    : [
        {
          icon: Smartphone,
          title: "1. Comece pelos sensores do aparelho",
          body:
            "Os sensores do aparelho iniciam automaticamente. Com o celular na vertical, o aro começa inclinado 90° para trás/baixo (referência de tela para baixo). Incline o celular para apontar o corte. Para usar a moldura ProGenia, abra Ajustes e selecione Moldura BLE em Fonte de movimento.",
        },
        {
          icon: Camera,
          title: "2. Abra a câmera",
          body:
            "Ative a câmera para ver o mundo real junto com o corte. Com o celular, segure na vertical em frente ao corpo. Com a moldura, aponte a câmera para ela.",
        },
        {
          icon: RotateCcw,
          title: "3. Ajuste a posição inicial",
          body:
            "Quando estiver na posição que você quer, toque em Zerar orientação. Isso marca o ponto de referência para os cortes.",
        },
        {
          icon: Settings2,
          title: "4. Pause e ajuste",
          body:
            "Use o botão de floco de neve para deixar o corte parado. O botão de ajustes ao lado abre zoom, posição da fatia e sensibilidade do movimento.",
        },
      ];
}

async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: ONBOARDING_KEY });
    if (value === "1") return true;
  } catch {
    // ignore
  }
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}

async function markOnboardingSeen(): Promise<void> {
  localStorage.setItem(ONBOARDING_KEY, "1");
  if (!isNativeApp) return;
  try {
    await Preferences.set({ key: ONBOARDING_KEY, value: "1" });
  } catch {
    // ignore
  }
}

function ArSliceGuideDialog({
  open,
  onOpenChange,
  persistOnClose = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persistOnClose?: boolean;
}) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [step, setStep] = useState(0);
  const steps = useMemo(() => buildSteps(isEnglish), [isEnglish]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const close = () => {
    onOpenChange(false);
    if (persistOnClose) void markOnboardingSeen();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-md gap-4 border-cyan-500/20 bg-background/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEnglish ? "How to use the AR slices" : "Como usar os cortes em RA"}
          </DialogTitle>
          <DialogDescription>
            {isEnglish
              ? "Educational content for study. Not for diagnosis."
              : "Conteúdo educativo para estudo. Não use para diagnóstico."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === step ? "bg-cyan-500" : i < step ? "bg-cyan-500/50" : "bg-muted",
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="flex gap-4 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
            <current.icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold leading-snug">{current.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isEnglish ? `Step ${step + 1} of ${steps.length}` : `Passo ${step + 1} de ${steps.length}`}
        </p>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            {isEnglish ? "Skip" : "Pular"}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                {isEnglish ? "Back" : "Voltar"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isLast) close();
                else setStep((s) => s + 1);
              }}
            >
              {isLast
                ? isEnglish
                  ? "Start"
                  : "Começar"
                : isEnglish
                  ? "Next"
                  : "Próximo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** First-time guide when opening the AR Slice lab. */
export function ArSliceOnboardingDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasSeenOnboarding().then((seen) => {
      if (!cancelled && !seen) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ArSliceGuideDialog open={open} onOpenChange={setOpen} persistOnClose />;
}

/** Reopen the guide from the controls panel. */
export function ArSliceOnboardingTrigger({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-8 text-xs", className)}
        onClick={() => setOpen(true)}
        {...props}
      >
        <Smartphone className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {isEnglish ? "How to use" : "Como usar"}
      </Button>
      <ArSliceGuideDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
