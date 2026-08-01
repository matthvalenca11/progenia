import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DynamicChartViewer } from "@/components/dynamic-chart";
import { ProGeniaLogo } from "@/components/ProGeniaLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { parametricChartService, type ParametricChart } from "@/services/parametricChartService";
import { resolveI18nText } from "@/types/dynamicChart";
import { toast } from "sonner";

export default function ChartViewer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const [chart, setChart] = useState<ParametricChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadChart = async () => {
      try {
        setLoading(true);
        setNotFound(false);
        const data = await parametricChartService.getPublishedBySlug(slug);

        if (cancelled) return;

        if (!data) {
          setChart(null);
          setNotFound(true);
          return;
        }

        setChart(data);
      } catch (error) {
        console.error("Error loading chart:", error);
        if (!cancelled) {
          toast.error(
            isEnglish ? "Could not load chart." : "Não foi possível carregar o gráfico.",
          );
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadChart();

    return () => {
      cancelled = true;
    };
  }, [slug, isEnglish]);

  const exit = () => {
    navigate(user ? "/dashboard" : "/");
  };

  const pageTitle =
    chart?.title?.trim() ||
    (chart?.config_data ? resolveI18nText(chart.config_data.title, language) : "") ||
    (isEnglish ? "Parametric chart" : "Gráfico paramétrico");

  const pageDescription =
    chart?.description?.trim() ||
    (chart?.config_data ? resolveI18nText(chart.config_data.description, language) : "");

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{isEnglish ? "Loading" : "Carregando"}</p>
        </div>
      </div>
    );
  }

  if (notFound || !chart?.config_data) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <header className="border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={exit}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEnglish ? "Back" : "Voltar"}
            </button>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <LineChart className="h-10 w-10 text-muted-foreground/50" />
          <h1 className="text-lg font-semibold">
            {isEnglish ? "Chart unavailable" : "Gráfico indisponível"}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {isEnglish
              ? "Not found or not published."
              : "Não encontrado ou ainda não publicado."}
          </p>
          <Button variant="outline" onClick={exit}>
            {isEnglish ? "Go back" : "Voltar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="safe-sticky-top border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 px-2" onClick={exit}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{isEnglish ? "Back" : "Voltar"}</span>
            </Button>
            <div
              className="hidden cursor-pointer items-center gap-2 sm:flex"
              onClick={() => navigate(user ? "/dashboard" : "/")}
            >
              <ProGeniaLogo className="h-8 progenia-logo" />
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{pageTitle}</h1>
            {pageDescription && (
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {pageDescription}
              </p>
            )}
          </div>

          <div className="mx-auto w-full max-w-3xl">
            <DynamicChartViewer config={chart.config_data} />
          </div>
        </div>
      </main>
    </div>
  );
}
