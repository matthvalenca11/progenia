import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DashboardFilters as DashboardFiltersType } from "@/services/adminAnalyticsService";
import { isNativeApp } from "@/lib/capacitor";
import { cn } from "@/lib/utils";

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

const fieldShell = "min-w-0 overflow-hidden space-y-1.5";
const controlClass = "h-9 w-full min-w-0 max-w-full";
const dateControlClass = "block h-9 w-full min-w-0 max-w-full appearance-none";
const dateRowClass = cn(
  "grid min-w-0 grid-cols-1 gap-3",
  isNativeApp ? "xl:grid-cols-2" : "md:grid-cols-2",
);

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
    <div className="min-w-0 space-y-4 overflow-hidden rounded-lg border bg-card p-3">
      {/* Datas em linha própria — inputs type=date precisam de largura no iPad */}
      <div className={dateRowClass}>
        <div className={fieldShell}>
          <Label htmlFor="dash-start">Data inicial</Label>
          <Input
            id="dash-start"
            type="date"
            className={dateControlClass}
            value={draftFilters.startDate}
            onChange={(e) => {
              setDateError(null);
              onDraftChange({ ...draftFilters, startDate: e.target.value });
            }}
          />
        </div>

        <div className={fieldShell}>
          <Label htmlFor="dash-end">Data final</Label>
          <Input
            id="dash-end"
            type="date"
            className={dateControlClass}
            value={draftFilters.endDate}
            onChange={(e) => {
              setDateError(null);
              onDraftChange({ ...draftFilters, endDate: e.target.value });
            }}
          />
        </div>
      </div>

      {/* Demografia: 1 col mobile, 2 tablet, 3 desktop largo */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className={fieldShell}>
          <Label>Gênero</Label>
          <Select
            value={draftFilters.gender ?? "all"}
            onValueChange={(value) =>
              onDraftChange({ ...draftFilters, gender: value === "all" ? null : value })
            }
          >
            <SelectTrigger className={controlClass}>
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

        <div className={fieldShell}>
          <Label>Estado</Label>
          <Select
            value={draftFilters.stateUf ?? "all"}
            onValueChange={(value) =>
              onDraftChange({ ...draftFilters, stateUf: value === "all" ? null : value })
            }
          >
            <SelectTrigger className={controlClass}>
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

        <div className={fieldShell}>
          <Label>Profissão</Label>
          <Select
            value={draftFilters.profession ?? "all"}
            onValueChange={(value) =>
              onDraftChange({ ...draftFilters, profession: value === "all" ? null : value })
            }
          >
            <SelectTrigger className={controlClass}>
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
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 min-w-0">
          {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          {!dateError && hasPendingChanges && (
            <p className="text-sm text-muted-foreground">
              Filtros alterados — clique em Aplicar para atualizar o dashboard.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 justify-end">
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
};
