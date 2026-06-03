import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProGeniaLogo } from "@/components/ProGeniaLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  completeNativeLanguageOnboarding,
  type AppLanguage,
} from "@/lib/nativeLanguageOnboarding";

type Props = {
  onComplete: () => void;
};

export function NativeLanguageOnboarding({ onComplete }: Props) {
  const { setLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);

  const choose = async (language: AppLanguage) => {
    if (saving) return;
    setSaving(true);
    try {
      setLanguage(language);
      await completeNativeLanguageOnboarding(language);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="native-safe-shell fixed inset-0 z-[100] flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6"
      data-no-auto-translate="true"
    >
      <Card className="w-full max-w-sm border-border/80 p-6 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <ProGeniaLogo className="mb-5 h-11 w-auto" />
          <div className="space-y-1">
            <p className="text-lg font-semibold leading-snug tracking-tight text-foreground">
              Choose your language
            </p>
            <p className="text-lg font-semibold leading-snug tracking-tight text-foreground">
              Escolha seu idioma
            </p>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-sm leading-snug text-muted-foreground">
              Change anytime in settings.
            </p>
            <p className="text-sm leading-snug text-muted-foreground">
              Pode alterar depois nas configurações.
            </p>
          </div>
        </div>

        <div className="flex flex-row gap-3">
          <Button
            type="button"
            size="lg"
            className="h-11 min-w-0 flex-1 text-sm"
            disabled={saving}
            onClick={() => void choose("pt")}
          >
            Português
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-11 min-w-0 flex-1 text-sm"
            disabled={saving}
            onClick={() => void choose("en")}
          >
            English
          </Button>
        </div>
      </Card>
    </div>
  );
}
