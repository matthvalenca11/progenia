import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ContentUsagePoint, TopContentPoint } from "@/services/adminAnalyticsService";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface LessonsCapsulesUsageChartsProps {
  contentUsage: ContentUsagePoint[];
  topContent: TopContentPoint[];
}

export function LessonsCapsulesUsageCharts({
  contentUsage,
  topContent,
}: LessonsCapsulesUsageChartsProps) {
  const groupedUsage = ["lesson", "capsula"].map((type) => {
    const starts = contentUsage
      .filter((item) => item.content_type === type)
      .reduce((acc, item) => acc + item.total, 0);
    const completed = contentUsage
      .filter((item) => item.content_type === type && item.status === "concluido")
      .reduce((acc, item) => acc + item.total, 0);

    return {
      type: type === "lesson" ? "Aulas" : "Cápsulas",
      starts,
      completed,
    };
  });

  const topContentChart = topContent.slice(0, 10).map((item) => ({
    label: item.title.length > 28 ? `${item.title.slice(0, 28)}...` : item.title,
    completions: item.completions,
    completion_rate: item.completion_rate,
  }));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Card className="p-3 bg-card/80">
        <h3 className="font-semibold mb-2">Início x Conclusão (Aulas e Cápsulas)</h3>
        <ChartContainer
          config={{
            starts: { label: "Inícios", color: "#f59e0b" },
            completed: { label: "Conclusões", color: "#10b981" },
          }}
          className="h-[240px] w-full"
        >
          <BarChart data={groupedUsage}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="type" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="starts" fill="var(--color-starts)" radius={6} />
            <Bar dataKey="completed" fill="var(--color-completed)" radius={6} />
          </BarChart>
        </ChartContainer>
      </Card>

      <Card className="p-3 bg-card/80">
        <h3 className="font-semibold mb-2">Top conteúdos por conclusão</h3>
        <ChartContainer
          config={{
            completions: { label: "Conclusões", color: "#2563eb" },
          }}
          className="h-[240px] w-full"
        >
          <BarChart data={topContentChart} layout="vertical">
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={180} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="completions" fill="var(--color-completions)" radius={6} />
          </BarChart>
        </ChartContainer>
      </Card>
    </div>
  );
}
