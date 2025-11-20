import { useState } from "react";
import { useModules } from "@/hooks/useModules";
import { moduleService } from "@/services/moduleService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ModuleFormData = {
  title: string;
  description: string;
  is_published: boolean;
};

export function ModulesManager() {
  const { modules, loading, refetch } = useModules(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [formData, setFormData] = useState<ModuleFormData>({
    title: "",
    description: "",
    is_published: false,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      is_published: false,
    });
  };

  const handleCreate = async () => {
    try {
      await moduleService.createModule(formData);
      toast.success("Módulo criado com sucesso!");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error("Erro ao criar módulo: " + error.message);
    }
  };

  const handleEdit = async () => {
    if (!editingModule) return;
    
    try {
      await moduleService.updateModule(editingModule.id, formData);
      toast.success("Módulo atualizado com sucesso!");
      setIsEditOpen(false);
      setEditingModule(null);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar módulo: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteModuleId) return;

    try {
      await moduleService.deleteModule(deleteModuleId);
      toast.success("Módulo excluído com sucesso!");
      setDeleteModuleId(null);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao excluir módulo: " + error.message);
    }
  };

  const handleTogglePublish = async (moduleId: string, currentStatus: boolean) => {
    try {
      await moduleService.togglePublish(moduleId, !currentStatus);
      toast.success(currentStatus ? "Módulo despublicado" : "Módulo publicado");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const openEditDialog = (module: any) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description || "",
      is_published: module.is_published,
    });
    setIsEditOpen(true);
  };

  if (loading) {
    return <div className="p-4">Carregando módulos...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Módulos</CardTitle>
              <CardDescription>Crie e organize os módulos do curso</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Módulo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Módulo</DialogTitle>
                  <DialogDescription>Preencha as informações do módulo</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Nome do módulo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrição do módulo"
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="published"
                      checked={formData.is_published}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                    />
                    <Label htmlFor="published">Publicar imediatamente</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate}>Criar Módulo</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum módulo criado ainda
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((module) => (
                  <TableRow key={module.id}>
                    <TableCell className="font-medium">{module.title}</TableCell>
                    <TableCell className="max-w-md truncate">{module.description}</TableCell>
                    <TableCell>
                      <Badge variant={module.is_published ? "default" : "secondary"}>
                        {module.is_published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(module.id, module.is_published)}
                        >
                          {module.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(module)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteModuleId(module.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Módulo</DialogTitle>
            <DialogDescription>Atualize as informações do módulo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Título</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
              />
              <Label htmlFor="edit-published">Publicado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteModuleId} onOpenChange={() => setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este módulo? Esta ação não pode ser desfeita e todas as aulas associadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
