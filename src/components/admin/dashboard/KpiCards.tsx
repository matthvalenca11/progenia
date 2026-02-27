import { Card } from "@/components/ui/card";
import { DashboardKpis } from "@/services/adminAnalyticsService";

interface KpiCardsProps {
  kpis: DashboardKpis;
}

const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

export function KpiCards({ kpis }: KpiCardsProps) {
  const cards = [
    { label: "Usuários totais", value: kpis.totalUsers.toLocaleString() },
    { label: "Novos no período", value: kpis.newUsers.toLocaleString() },
    { label: "Usuários ativos", value: kpis.activeUsers.toLocaleString() },
    { label: "Conclusões de aulas", value: kpis.lessonCompletions.toLocaleString() },
    { label: "Conclusões de cápsulas", value: kpis.capsulaCompletions.toLocaleString() },
    { label: "Progresso médio de aulas", value: `${kpis.avgLessonProgress.toFixed(1)}%` },
    { label: "Sessões de labs", value: kpis.totalLabSessions.toLocaleString() },
    { label: "Tempo em labs", value: formatHours(kpis.totalLabTimeSeconds) },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-3 bg-card/80 hover:bg-card transition-colors">
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className="text-xl font-bold mt-1">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}
