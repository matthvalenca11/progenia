import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DemographicPoint, SignupsPoint } from "@/services/adminAnalyticsService";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";

interface SignupsAndDemographicsChartsProps {
  signupsSeries: SignupsPoint[];
  demographics: DemographicPoint[];
}

export function SignupsAndDemographicsCharts({
  signupsSeries,
  demographics,
}: SignupsAndDemographicsChartsProps) {
  const genderData = demographics.filter((item) => item.dimension === "gender");
  const stateData = demographics
    .filter((item) => item.dimension === "state_uf")
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <Card className="p-3 xl:col-span-2 bg-card/80">
        <h3 className="font-semibold mb-2">Novos cadastros por dia</h3>
        <ChartContainer
          config={{
            signups: { label: "Cadastros", color: "#2563eb" },
          }}
          className="h-[240px] w-full"
        >
          <LineChart data={signupsSeries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="signups" stroke="var(--color-signups)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </Card>

      <Card className="p-3 bg-card/80">
        <h3 className="font-semibold mb-2">Distribuição por gênero</h3>
        <ChartContainer
          config={{
            total: { label: "Usuários", color: "#10b981" },
          }}
          className="h-[240px] w-full"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={genderData} dataKey="total" nameKey="label" outerRadius={90} fill="var(--color-total)" />
          </PieChart>
        </ChartContainer>
      </Card>

      <Card className="p-3 xl:col-span-3 bg-card/80">
        <h3 className="font-semibold mb-2">Top estados por cadastro</h3>
        <ChartContainer
          config={{
            total: { label: "Cadastros", color: "#8b5cf6" },
          }}
          className="h-[250px] w-full"
        >
          <BarChart data={stateData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={6} />
          </BarChart>
        </ChartContainer>
      </Card>
    </div>
  );
}
