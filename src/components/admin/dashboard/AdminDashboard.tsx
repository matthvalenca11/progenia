import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { adminAnalyticsService, DashboardFilters as DashboardFiltersType } from "@/services/adminAnalyticsService";
import { DashboardFilters } from "./DashboardFilters";
import { KpiCards } from "./KpiCards";
import { SignupsAndDemographicsCharts } from "./SignupsAndDemographicsCharts";
import { LessonsCapsulesUsageCharts } from "./LessonsCapsulesUsageCharts";
import { EngagementCharts } from "./EngagementCharts";
import { LabsUsageCharts } from "./LabsUsageCharts";
import { DashboardDrilldownTable } from "./DashboardDrilldownTable";

const getDefaultFilters = (): DashboardFiltersType => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    gender: null,
    stateUf: null,
    profession: null,
  };
};

export function AdminDashboard() {
  const [filters, setFilters] = useState<DashboardFiltersType>(getDefaultFilters());
  const isDateRangeValid = filters.startDate <= filters.endDate;

  const filterOptionsQuery = useQuery({
    queryKey: ["admin-dashboard-filter-options"],
    queryFn: () => adminAnalyticsService.getFilterOptions(),
    staleTime: 60_000,
  });

  const dataQuery = useQuery({
    queryKey: ["admin-dashboard-data", filters],
    queryFn: () => adminAnalyticsService.getDashboardData(filters),
    staleTime: 30_000,
    enabled: isDateRangeValid,
  });
  if (!isDateRangeValid) {
    return (
      <Card className="p-4">
        <p className="text-destructive">A data inicial não pode ser maior que a data final.</p>
      </Card>
    );
  }


  const filterOptions = useMemo(
    () =>
      filterOptionsQuery.data || {
        genders: [],
        states: [],
        professions: [],
      },
    [filterOptionsQuery.data],
  );

  if (dataQuery.isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (dataQuery.error) {
    return (
      <Card className="p-4">
        <p className="text-destructive">
          Erro ao carregar dashboard: {(dataQuery.error as Error).message}
        </p>
      </Card>
    );
  }

  const data = dataQuery.data!;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card/60 p-3">
        <h2 className="text-lg font-semibold">Visão geral da plataforma</h2>
        <p className="text-sm text-muted-foreground">
          Indicadores de cadastro, conteúdo, engajamento e uso dos labs em um só lugar.
        </p>
      </div>

      <DashboardFilters
        filters={filters}
        options={filterOptions}
        onChange={setFilters}
        onReset={() => setFilters(getDefaultFilters())}
      />

      <KpiCards kpis={data.kpis} />

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cadastro e demografia</h3>
        <SignupsAndDemographicsCharts signupsSeries={data.signupsSeries} demographics={data.demographics} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consumo de conteúdo</h3>
        <LessonsCapsulesUsageCharts contentUsage={data.contentUsage} topContent={data.topContent} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Engajamento</h3>
        <EngagementCharts engagementSeries={data.engagementSeries} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labs virtuais</h3>
        <LabsUsageCharts labsUsage={data.labsUsage} />
      </div>

      <DashboardDrilldownTable topContent={data.topContent} labsUsage={data.labsUsage} />
    </div>
  );
}
