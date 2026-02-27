import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LabUsagePoint } from "@/services/adminAnalyticsService";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface LabsUsageChartsProps {
  labsUsage: LabUsagePoint[];
}

const formatTime = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

export function LabsUsageCharts({ labsUsage }: LabsUsageChartsProps) {
  const sessionsChart = labsUsage.slice(0, 10).map((item) => ({
    label: item.lab_name.length > 26 ? `${item.lab_name.slice(0, 26)}...` : item.lab_name,
    sessions: item.sessions,
    users: item.unique_users,
  }));

  const totals = labsUsage.reduce(
    (acc, item) => {
      acc.sessions += item.sessions;
      acc.time += item.total_time_seconds;
      acc.users += item.unique_users;
      return acc;
    },
    { sessions: 0, time: 0, users: 0 },
  );

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <Card className="p-3 xl:col-span-2 bg-card/80">
        <h3 className="font-semibold mb-2">Uso de Labs (sessões e usuários)</h3>
        <ChartContainer
          config={{
            sessions: { label: "Sessões", color: "#06b6d4" },
            users: { label: "Usuários", color: "#3b82f6" },
          }}
          className="h-[250px] w-full"
        >
          <BarChart data={sessionsChart}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sessions" fill="var(--color-sessions)" radius={6} />
            <Bar dataKey="users" fill="var(--color-users)" radius={6} />
          </BarChart>
        </ChartContainer>
      </Card>

      <Card className="p-3 space-y-2.5 bg-card/80">
        <h3 className="font-semibold">Resumo de Labs</h3>
        <div>
          <p className="text-sm text-muted-foreground">Sessões</p>
          <p className="text-2xl font-bold">{totals.sessions.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Usuários únicos (somados)</p>
          <p className="text-2xl font-bold">{totals.users.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Tempo total</p>
          <p className="text-2xl font-bold">{formatTime(totals.time)}</p>
        </div>
      </Card>
    </div>
  );
}
