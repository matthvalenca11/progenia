import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search, Beaker, Play, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UltrasoundUnifiedLab } from "@/components/labs/UltrasoundUnifiedLab";

export default function VirtualLabsAdmin() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState<VirtualLab[]>([]);
  const [filteredLabs, setFilteredLabs] = useState<VirtualLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labToDelete, setLabToDelete] = useState<VirtualLab | null>(null);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [labToTest, setLabToTest] = useState<VirtualLab | null>(null);

  useEffect(() => {
    loadLabs();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = labs.filter(
        (lab) =>
          lab.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lab.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLabs(filtered);
    } else {
      setFilteredLabs(labs);
    }
  }, [searchTerm, labs]);

  const loadLabs = async () => {
    try {
      setLoading(true);
      const data = await virtualLabService.getAllLabs();
      setLabs(data);
      setFilteredLabs(data);
    } catch (error: any) {
      toast.error("Erro ao carregar laboratórios", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (lab: VirtualLab) => {
    setLabToDelete(lab);
    if (lab.id) {
      const count = await virtualLabService.getLabUsageCount(lab.id);
      setUsageCount(count);
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!labToDelete?.id) return;

    try {
      await virtualLabService.deleteLab(labToDelete.id);
      toast.success("Laboratório excluído com sucesso!");
      loadLabs();
    } catch (error: any) {
      toast.error("Erro ao excluir laboratório", { description: error.message });
    } finally {
      setDeleteDialogOpen(false);
      setLabToDelete(null);
      setUsageCount(0);
    }
  };

  const handleTestClick = (lab: VirtualLab) => {
    setLabToTest(lab);
    setTestDialogOpen(true);
  };

  const handleTogglePublish = async (lab: VirtualLab) => {
    if (!lab.id) return;

    try {
      await virtualLabService.updateLab(lab.id, {
        is_published: !lab.is_published
      });
      toast.success(lab.is_published ? "Laboratório despublicado!" : "Laboratório publicado!");
      loadLabs();
    } catch (error: any) {
      toast.error("Erro ao alterar status", { description: error.message });
    }
  };

  const getLabTypeBadge = (type: string) => {
    const badges = {
      ultrasound: { label: "Ultrassom", variant: "default" as const },
      electrotherapy: { label: "Eletroterapia", variant: "secondary" as const },
      thermal: { label: "Térmico", variant: "outline" as const },
      other: { label: "Outro", variant: "outline" as const },
    };
    const badge = badges[type as keyof typeof badges] || badges.other;
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Carregando laboratórios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Beaker className="h-8 w-8" />
            Laboratórios Virtuais
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie laboratórios virtuais reutilizáveis
          </p>
        </div>
        <Button onClick={() => navigate("/admin/labs/novo")} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Criar Novo Laboratório
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Laboratórios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Labs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Laboratórios</CardTitle>
          <CardDescription>
            {filteredLabs.length} laboratório(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLabs.length === 0 ? (
            <div className="text-center py-12">
              <Beaker className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhum laboratório encontrado com esse termo"
                  : "Nenhum laboratório criado ainda"}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => navigate("/admin/labs/novo")}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Laboratório
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLabs.map((lab) => (
                  <TableRow key={lab.id}>
                    <TableCell className="font-medium">{lab.name}</TableCell>
                    <TableCell>{getLabTypeBadge(lab.lab_type)}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {lab.description || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={lab.is_published ? "default" : "secondary"}>
                        {lab.is_published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lab.updated_at
                        ? format(new Date(lab.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(lab)}
                          title={lab.is_published ? "Despublicar" : "Publicar"}
                        >
                          {lab.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestClick(lab)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Testar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/labs/editar/${lab.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(lab)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Laboratório Virtual?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o laboratório "{labToDelete?.name}"?
              {usageCount > 0 && (
                <span className="block mt-2 font-medium text-destructive">
                  ⚠️ Este laboratório está sendo usado em {usageCount} cápsula(s). As cápsulas
                  perderão a referência ao laboratório.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Lab Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Testar Laboratório: {labToTest?.name}</DialogTitle>
            <DialogDescription>
              {labToTest?.description || "Pré-visualização completa do laboratório virtual"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {labToTest?.lab_type === "ultrasound" && labToTest.config_data && (
              <UltrasoundUnifiedLab config={labToTest.config_data as any} />
            )}
            {labToTest?.lab_type === "electrotherapy" && (
              <div className="p-8 text-center text-muted-foreground">
                <Beaker className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Simulador de eletroterapia em desenvolvimento</p>
                <p className="text-sm mt-2">Em breve você poderá testar este tipo de laboratório</p>
              </div>
            )}
            {labToTest?.lab_type === "thermal" && (
              <div className="p-8 text-center text-muted-foreground">
                <Beaker className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Simulador térmico em desenvolvimento</p>
                <p className="text-sm mt-2">Em breve você poderá testar este tipo de laboratório</p>
              </div>
            )}
            {(!labToTest?.lab_type || (labToTest?.lab_type === "other")) && (
              <div className="p-8 text-center text-muted-foreground">
                <Beaker className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Tipo de laboratório não reconhecido</p>
                <p className="text-sm mt-2">Verifique a configuração do laboratório</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
