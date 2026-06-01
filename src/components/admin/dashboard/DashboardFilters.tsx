import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DashboardFilters as DashboardFiltersType } from "@/services/adminAnalyticsService";

interface DashboardFiltersProps {
  draftFilters: DashboardFiltersType;
  appliedFilters: DashboardFiltersType;
  onDraftChange: (next: DashboardFiltersType) => void;
  onApply: () => void;
  options: {
    genders: string[];
    states: string[];
    professions: string[];
  };
  onReset: () => void;
}

export function DashboardFilters({
  draftFilters,
  appliedFilters,
  onDraftChange,
  onApply,
  options,
  onReset,
}: DashboardFiltersProps) {
  const [dateError, setDateError] = useState<string | null>(null);

  const hasPendingChanges =
    draftFilters.startDate !== appliedFilters.startDate ||
    draftFilters.endDate !== appliedFilters.endDate ||
    draftFilters.gender !== appliedFilters.gender ||
    draftFilters.stateUf !== appliedFilters.stateUf ||
    draftFilters.profession !== appliedFilters.profession;

  const handleApply = () => {
    if (draftFilters.startDate > draftFilters.endDate) {
      setDateError("A data inicial não pode ser maior que a data final.");
      return;
    }
    setDateError(null);
    onApply();
  };

  return (
    <div className="rounded-lg border bg-card p-3 grid gap-3 md:grid-cols-5">
      <div className="space-y-1.5">
        <Label htmlFor="dash-start">Data inicial</Label>
        <Input
          id="dash-start"
          type="date"
          className="h-9"
          value={draftFilters.startDate}
          onChange={(e) => {
            setDateError(null);
            onDraftChange({ ...draftFilters, startDate: e.target.value });
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dash-end">Data final</Label>
        <Input
          id="dash-end"
          type="date"
          className="h-9"
          value={draftFilters.endDate}
          onChange={(e) => {
            setDateError(null);
            onDraftChange({ ...draftFilters, endDate: e.target.value });
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Gênero</Label>
        <Select
          value={draftFilters.gender ?? "all"}
          onValueChange={(value) =>
            onDraftChange({ ...draftFilters, gender: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {options.genders.map((gender) => (
              <SelectItem key={gender} value={gender}>
                {gender}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Estado</Label>
        <Select
          value={draftFilters.stateUf ?? "all"}
          onValueChange={(value) =>
            onDraftChange({ ...draftFilters, stateUf: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {options.states.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Profissão</Label>
        <Select
          value={draftFilters.profession ?? "all"}
          onValueChange={(value) =>
            onDraftChange({ ...draftFilters, profession: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {options.professions.map((profession) => (
              <SelectItem key={profession} value={profession}>
                {profession}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5">
          {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          {!dateError && hasPendingChanges && (
            <p className="text-sm text-muted-foreground">
              Filtros alterados — clique em Aplicar para atualizar o dashboard.
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" className="h-9" onClick={onReset}>
            Limpar filtros
          </Button>
          <Button className="h-9" onClick={handleApply} disabled={!hasPendingChanges}>
            Aplicar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
