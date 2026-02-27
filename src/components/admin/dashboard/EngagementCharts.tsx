import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { EngagementPoint } from "@/services/adminAnalyticsService";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

interface EngagementChartsProps {
  engagementSeries: EngagementPoint[];
}

export function EngagementCharts({ engagementSeries }: EngagementChartsProps) {
  return (
    <Card className="p-3 bg-card/80">
      <h3 className="font-semibold mb-2">Engajamento diário (DAU, conclusões e quiz)</h3>
      <ChartContainer
        config={{
          dau: { label: "DAU", color: "#2563eb" },
          lesson_completions: { label: "Conclusões de aulas", color: "#10b981" },
          capsula_completions: { label: "Conclusões de cápsulas", color: "#f59e0b" },
          quiz_attempts: { label: "Tentativas de quiz", color: "#8b5cf6" },
        }}
        className="h-[260px] w-full"
      >
        <LineChart data={engagementSeries}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line dataKey="dau" stroke="var(--color-dau)" strokeWidth={2} dot={false} />
          <Line dataKey="lesson_completions" stroke="var(--color-lesson_completions)" strokeWidth={2} dot={false} />
          <Line dataKey="capsula_completions" stroke="var(--color-capsula_completions)" strokeWidth={2} dot={false} />
          <Line dataKey="quiz_attempts" stroke="var(--color-quiz_attempts)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </Card>
  );
}
