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
import { LabPreviewContent } from "@/components/labs/LabPreviewContent";
import { cn, toErrorMessage } from "@/lib/utils";

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
  const [landingDemoUpdatingId, setLandingDemoUpdatingId] = useState<string | null>(null);

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
    } catch (error: unknown) {
      toast.error("Erro ao carregar laboratórios", { description: toErrorMessage(error) });
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
      // Se for lab MRI, limpar dados do volume (se houver em memória)
      if (labToDelete.lab_type === "mri") {
        // Importar dinamicamente para evitar dependência circular
        const { useMRILabStore } = await import("@/stores/mriLabStore");
        useMRILabStore.getState().clearVolume();
      }
      
      await virtualLabService.deleteLab(labToDelete.id);
      toast.success("Laboratório excluído com sucesso!");
      loadLabs();
    } catch (error: unknown) {
      toast.error("Erro ao excluir laboratório", { description: toErrorMessage(error) });
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
      const nextPublished = !lab.is_published;
      await virtualLabService.updateLab(lab.id, {
        is_published: nextPublished,
        ...(nextPublished === false ? { is_landing_demo: false } : {}),
      });
      toast.success(
        lab.is_published 
          ? "Laboratório indisponível para cápsulas" 
          : "Laboratório disponível para uso em cápsulas!"
      );
      loadLabs();
    } catch (error: unknown) {
      toast.error("Erro ao alterar status", { description: toErrorMessage(error) });
    }
  };

  const handleToggleLandingDemo = async (lab: VirtualLab) => {
    if (!lab.id) return;
    const next = !lab.is_landing_demo;
    if (next && !lab.is_published) {
      toast.error("Publique o laboratório antes de usá-lo como demo na landing.");
      return;
    }
    try {
      setLandingDemoUpdatingId(lab.id);
      await virtualLabService.setLandingDemoForType(lab.id, lab.lab_type, next);
      toast.success(
        next
          ? "Este laboratório é o demo da landing para este tipo. Outros do mesmo tipo foram desmarcados."
          : "Demo da landing removido para este laboratório.",
      );
      await loadLabs();
    } catch (error: unknown) {
      toast.error("Não foi possível atualizar o demo da landing", { description: toErrorMessage(error) });
    } finally {
      setLandingDemoUpdatingId(null);
    }
  };

  const getLabTypeBadge = (type: string) => {
    const badges = {
      ultrasound: { label: "Ultrassom", variant: "default" as const },
      tens: { label: "TENS", variant: "default" as const },
      ultrasound_therapy: { label: "Ultrassom Terapêutico", variant: "default" as const },
      ultrassom_terapeutico: { label: "Ultrassom Terapêutico", variant: "default" as const },
      mri: { label: "Ressonância Magnética", variant: "default" as const },
      photobiomodulation: { label: "Fotobiomodulação", variant: "default" as const },
      fbm: { label: "Fotobiomodulação", variant: "default" as const },
      electrotherapy: { label: "Eletroterapia", variant: "default" as const },
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
                        {lab.is_published ? "Disponível" : "Indisponível"}
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
                          title={lab.is_published ? "Tornar indisponível para cápsulas" : "Disponibilizar para cápsulas"}
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
                          onClick={() => handleToggleLandingDemo(lab)}
                          disabled={landingDemoUpdatingId === lab.id || (!lab.is_published && !lab.is_landing_demo)}
                          title={
                            lab.is_landing_demo
                              ? "Remover como demo da página inicial"
                              : lab.is_published
                                ? "Usar como demo na landing (só um ativo por tipo de laboratório)"
                                : "Publique o lab para poder marcar como demo da landing"
                          }
                          className={cn(
                            "h-8 shrink-0 whitespace-nowrap px-2 text-xs font-semibold",
                            lab.is_landing_demo
                              ? "border-0 bg-[hsl(160_52%_44%)] text-white shadow-sm shadow-[hsl(160_45%_25%/0.35)] hover:bg-[hsl(160_52%_38%)] hover:text-white focus-visible:ring-[hsl(160_52%_50%)] dark:bg-[hsl(158_48%_52%)] dark:text-[hsl(220_30%_10%)] dark:shadow-[hsl(160_40%_20%/0.4)] dark:hover:bg-[hsl(158_48%_46%)] dark:hover:text-[hsl(220_30%_10%)]"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          Demo Lab
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
        <DialogContent className="max-w-7xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Testar Laboratório: {labToTest?.name}</DialogTitle>
            <DialogDescription>
              {labToTest?.description || "Pré-visualização completa do laboratório virtual"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {labToTest ? <LabPreviewContent lab={labToTest} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
