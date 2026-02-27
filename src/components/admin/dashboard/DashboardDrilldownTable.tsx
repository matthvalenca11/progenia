import { Card } from "@/components/ui/card";
import { LabUsagePoint, TopContentPoint } from "@/services/adminAnalyticsService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DashboardDrilldownTableProps {
  topContent: TopContentPoint[];
  labsUsage: LabUsagePoint[];
}

export function DashboardDrilldownTable({ topContent, labsUsage }: DashboardDrilldownTableProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Card className="p-3 bg-card/80">
        <h3 className="font-semibold mb-2">Drilldown: Top conteúdos</h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Inícios</TableHead>
                <TableHead>Conclusões</TableHead>
                <TableHead>Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topContent.map((item) => (
                <TableRow key={`${item.content_type}-${item.content_id}`}>
                  <TableCell>{item.content_type === "lesson" ? "Aula" : "Cápsula"}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{item.title}</TableCell>
                  <TableCell>{item.starts.toLocaleString()}</TableCell>
                  <TableCell>{item.completions.toLocaleString()}</TableCell>
                  <TableCell>{item.completion_rate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-3 bg-card/80">
        <h3 className="font-semibold mb-2">Drilldown: Uso por lab</h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab</TableHead>
                <TableHead>Sessões</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Tempo total (s)</TableHead>
                <TableHead>Interações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labsUsage.map((item) => (
                <TableRow key={item.lab_id}>
                  <TableCell className="max-w-[220px] truncate">{item.lab_name}</TableCell>
                  <TableCell>{item.sessions.toLocaleString()}</TableCell>
                  <TableCell>{item.unique_users.toLocaleString()}</TableCell>
                  <TableCell>{item.total_time_seconds.toLocaleString()}</TableCell>
                  <TableCell>{item.interactions.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
