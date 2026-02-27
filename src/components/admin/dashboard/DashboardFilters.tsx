import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DashboardFilters as DashboardFiltersType } from "@/services/adminAnalyticsService";

interface DashboardFiltersProps {
  filters: DashboardFiltersType;
  onChange: (next: DashboardFiltersType) => void;
  options: {
    genders: string[];
    states: string[];
    professions: string[];
  };
  onReset: () => void;
}

export function DashboardFilters({ filters, onChange, options, onReset }: DashboardFiltersProps) {
  return (
    <div className="rounded-lg border bg-card p-3 grid gap-3 md:grid-cols-5">
      <div className="space-y-1.5">
        <Label htmlFor="dash-start">Data inicial</Label>
        <Input
          id="dash-start"
          type="date"
          className="h-9"
          value={filters.startDate}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dash-end">Data final</Label>
        <Input
          id="dash-end"
          type="date"
          className="h-9"
          value={filters.endDate}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Gênero</Label>
        <Select
          value={filters.gender ?? "all"}
          onValueChange={(value) => onChange({ ...filters, gender: value === "all" ? null : value })}
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
          value={filters.stateUf ?? "all"}
          onValueChange={(value) => onChange({ ...filters, stateUf: value === "all" ? null : value })}
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
          value={filters.profession ?? "all"}
          onValueChange={(value) => onChange({ ...filters, profession: value === "all" ? null : value })}
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

      <div className="md:col-span-5 flex justify-end">
        <Button variant="outline" className="h-9" onClick={onReset}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
