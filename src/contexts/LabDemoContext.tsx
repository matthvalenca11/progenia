import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { LAB_DEMO_DURATION_MS, labDemoStorageKey } from "@/constants/labDemo";
import { Clock, LogIn } from "lucide-react";

export type LabDemoContextValue = {
  /** Visitante sem conta: modo demonstração com tempo limitado */
  isDemoMode: boolean;
  /** Tempo da demo esgotado (blur + CTA) */
  demoExpired: boolean;
  /** Milissegundos restantes (0 se expirado ou não for demo) */
  demoRemainingMs: number;
};

const LabDemoContext = createContext<LabDemoContextValue | null>(null);

export function useLabDemo(): LabDemoContextValue {
  const ctx = useContext(LabDemoContext);
  if (!ctx) {
    return {
      isDemoMode: false,
      demoExpired: false,
      demoRemainingMs: 0,
    };
  }
  return ctx;
}

type LabDemoBoundaryProps = {
  slug: string;
  enabled: boolean;
  children: ReactNode;
  /** No pop-up da landing: fecha o modal em vez de navegar para / (mesma rota). */
  onDismissSecondary?: () => void;
};

/**
 * Para visitantes: cronômetro por sessão (sessionStorage), banner informativo,
 * e ao expirar blur no conteúdo + convite para criar conta.
 */
export function LabDemoBoundary({ slug, enabled, children, onDismissSecondary }: LabDemoBoundaryProps) {
  const { language } = useLanguage();
  const en = language === "en";
  const [endAt, setEndAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !slug) {
      setEndAt(null);
      return;
    }
    const key = labDemoStorageKey(slug);
    try {
      const raw = sessionStorage.getItem(key);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(parsed) || parsed <= Date.now()) {
        const next = Date.now() + LAB_DEMO_DURATION_MS;
        sessionStorage.setItem(key, String(next));
        setEndAt(next);
      } else {
        setEndAt(parsed);
      }
    } catch {
      setEndAt(Date.now() + LAB_DEMO_DURATION_MS);
    }
  }, [enabled, slug]);

  useEffect(() => {
    if (!enabled || endAt == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled, endAt]);

  const demoExpired = enabled && endAt != null && nowTick >= endAt;
  const demoRemainingMs = enabled && endAt != null ? Math.max(0, endAt - nowTick) : 0;

  const value = useMemo<LabDemoContextValue>(
    () => ({
      isDemoMode: enabled,
      demoExpired,
      demoRemainingMs,
    }),
    [enabled, demoExpired, demoRemainingMs],
  );

  const fmtRemaining = useCallback(() => {
    const s = Math.ceil(demoRemainingMs / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }, [demoRemainingMs]);

  if (!enabled) {
    return <LabDemoContext.Provider value={value}>{children}</LabDemoContext.Provider>;
  }

  return (
    <LabDemoContext.Provider value={value}>
      <div className="relative w-full space-y-3">
        {!demoExpired && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            data-no-auto-translate="true"
          >
            <Clock className="h-4 w-4 shrink-0 opacity-80" />
            <p className="font-medium">
              {en
                ? "Limited demo — explore core controls. Time remaining:"
                : "Demonstração limitada — explore os controles principais. Tempo restante:"}{" "}
              <span className="tabular-nums">{fmtRemaining()}</span>
            </p>
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl">
          <div
            className={cn(
              "transition-[filter,opacity] duration-300",
              demoExpired && "pointer-events-none select-none blur-md opacity-60",
            )}
          >
            {children}
          </div>

          {demoExpired && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/65 p-4 backdrop-blur-md"
              data-no-auto-translate="true"
            >
              <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
                <p className="text-lg font-semibold text-foreground">
                  {en ? "This preview has ended" : "Esta visualização terminou"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {en
                    ? "Create a free account to keep exploring the labs, unlock the full toolset, and continue learning without limits."
                    : "Crie uma conta gratuita para continuar explorando os laboratórios, liberar todos os recursos e seguir aprendendo sem limites."}
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button asChild className="rounded-xl">
                    <Link to="/auth">
                      <LogIn className="mr-2 h-4 w-4" />
                      {en ? "Create account / Sign in" : "Criar conta / Entrar"}
                    </Link>
                  </Button>
                  {onDismissSecondary ? (
                    <Button type="button" variant="outline" className="rounded-xl" onClick={onDismissSecondary}>
                      {en ? "Close" : "Fechar"}
                    </Button>
                  ) : (
                    <Button variant="outline" asChild className="rounded-xl">
                      <Link to="/">{en ? "Back to home" : "Voltar ao início"}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </LabDemoContext.Provider>
  );
}
