import { Button } from "@/components/ui/button";
import { useConsent } from "@/contexts/ConsentContext";

export const CookieBanner = () => {
  const { ready, hasDecision, acceptAll, rejectOptional, openPreferences } = useConsent();

  if (!ready || hasDecision) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] rounded-lg border bg-background p-4 shadow-xl md:left-auto md:max-w-xl">
      <p className="text-sm text-muted-foreground">
        Usamos cookies para manter funcionalidades essenciais e medir desempenho. Voce pode aceitar todos ou
        configurar preferências.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void acceptAll()}>
          Aceitar todos
        </Button>
        <Button size="sm" variant="outline" onClick={() => void rejectOptional()}>
          Somente essenciais
        </Button>
        <Button size="sm" variant="ghost" onClick={openPreferences}>
          Gerenciar cookies
        </Button>
      </div>
    </div>
  );
};

