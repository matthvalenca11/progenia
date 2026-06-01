import { Card } from "@/components/ui/card";
import { DashboardFilters, DashboardKpis } from "@/services/adminAnalyticsService";
import {
  Activity,
  BookMarked,
  BookOpen,
  Clock,
  FlaskConical,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KpiCardsProps {
  kpis: DashboardKpis;
  filters: DashboardFilters;
}

const formatHours = (seconds: number) => {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
};

const formatPeriod = (filters: DashboardFilters) => {
  const start = new Date(`${filters.startDate}T00:00:00`);
  const end = new Date(`${filters.endDate}T00:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
};

export function KpiCards({ kpis, filters }: KpiCardsProps) {
  const periodLabel = formatPeriod(filters);

  const cards: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    accent: string;
  }[] = [
    {
      label: "Usuários cadastrados",
      value: kpis.totalUsers.toLocaleString("pt-BR"),
      hint: "Total na base (com filtros aplicados)",
      icon: Users,
      accent: "text-primary bg-primary/10",
    },
    {
      label: "Novos cadastros",
      value: kpis.newUsers.toLocaleString("pt-BR"),
      hint: periodLabel,
      icon: UserPlus,
      accent: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: "Usuários ativos",
      value: kpis.activeUsers.toLocaleString("pt-BR"),
      hint: "Estudaram ou usaram labs no período",
      icon: Activity,
      accent: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      label: "Aulas concluídas",
      value: kpis.lessonCompletions.toLocaleString("pt-BR"),
      hint: periodLabel,
      icon: BookOpen,
      accent: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
    },
    {
      label: "Cápsulas concluídas",
      value: kpis.capsulaCompletions.toLocaleString("pt-BR"),
      hint: periodLabel,
      icon: BookMarked,
      accent: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
    },
    {
      label: "Progresso médio",
      value: `${kpis.avgLessonProgress.toFixed(1)}%`,
      hint: "Média de aulas + cápsulas no período",
      icon: TrendingUp,
      accent: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    },
    {
      label: "Sessões em labs",
      value: kpis.totalLabSessions.toLocaleString("pt-BR"),
      hint: periodLabel,
      icon: FlaskConical,
      accent: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-400",
    },
    {
      label: "Tempo em labs",
      value: formatHours(kpis.totalLabTimeSeconds),
      hint: periodLabel,
      icon: Clock,
      accent: "text-orange-600 bg-orange-500/10 dark:text-orange-400",
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Métricas do período <span className="font-medium text-foreground">{periodLabel}</span>, salvo usuários cadastrados (total acumulado).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="bg-card/80 p-3 transition-colors hover:bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{card.value}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{card.hint}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
