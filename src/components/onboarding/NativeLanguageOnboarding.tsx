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
      <Card className="w-full max-w-md border-border/80 p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <ProGeniaLogo className="mb-6 h-12 w-auto" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Choose your language
          </h1>
          <p className="mt-1 text-lg font-medium text-muted-foreground">Escolha seu idioma</p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Select the language you want to use in the app. You can change this later in settings.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Selecione o idioma do aplicativo. Você poderá alterar depois nas configurações.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            type="button"
            size="lg"
            className="h-12 flex-1 text-base"
            disabled={saving}
            onClick={() => void choose("pt")}
          >
            Português
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 flex-1 text-base"
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
