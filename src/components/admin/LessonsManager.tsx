import { useState, useEffect } from "react";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  module_id: string | null;
  is_published: boolean;
  duration_minutes: number | null;
  order_index: number | null;
  content_data: any;
};

type LessonFormData = {
  title: string;
  description: string;
  module_id: string;
  is_published: boolean;
  duration_minutes: string;
};

export function LessonsManager() {
  const { modules } = useModules(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [filterModuleId, setFilterModuleId] = useState<string>("all");
  const [formData, setFormData] = useState<LessonFormData>({
    title: "",
    description: "",
    module_id: "",
    is_published: false,
    duration_minutes: "",
  });

  const loadLessons = async () => {
    try {
      setLoading(true);
      let query = supabase.from("lessons").select("*").order("order_index", { ascending: true });
      
      if (filterModuleId !== "all") {
        query = query.eq("module_id", filterModuleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLessons(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar aulas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, [filterModuleId]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      module_id: "",
      is_published: false,
      duration_minutes: "",
    });
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase.from("lessons").insert({
        title: formData.title,
        description: formData.description,
        module_id: formData.module_id || null,
        is_published: formData.is_published,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        content_data: { blocks: [] },
      });

      if (error) throw error;

      toast.success("Aula criada com sucesso!");
      setIsCreateOpen(false);
      resetForm();
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao criar aula: " + error.message);
    }
  };

  const handleEdit = async () => {
    if (!editingLesson) return;

    try {
      const { error } = await supabase
        .from("lessons")
        .update({
          title: formData.title,
          description: formData.description,
          module_id: formData.module_id || null,
          is_published: formData.is_published,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        })
        .eq("id", editingLesson.id);

      if (error) throw error;

      toast.success("Aula atualizada com sucesso!");
      setIsEditOpen(false);
      setEditingLesson(null);
      resetForm();
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao atualizar aula: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteLessonId) return;

    try {
      const { error } = await supabase.from("lessons").delete().eq("id", deleteLessonId);
      if (error) throw error;

      toast.success("Aula excluída com sucesso!");
      setDeleteLessonId(null);
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao excluir aula: " + error.message);
    }
  };

  const handleTogglePublish = async (lessonId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ is_published: !currentStatus })
        .eq("id", lessonId);

      if (error) throw error;

      toast.success(currentStatus ? "Aula despublicada" : "Aula publicada");
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const openEditDialog = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      description: lesson.description || "",
      module_id: lesson.module_id || "",
      is_published: lesson.is_published,
      duration_minutes: lesson.duration_minutes?.toString() || "",
    });
    setIsEditOpen(true);
  };

  const getModuleName = (moduleId: string | null) => {
    if (!moduleId) return "Sem módulo";
    const module = modules.find((m) => m.id === moduleId);
    return module?.title || "Módulo não encontrado";
  };

  if (loading) {
    return <div className="p-4">Carregando aulas...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Aulas</CardTitle>
              <CardDescription>Crie e organize as aulas dos módulos</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Aula
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Aula</DialogTitle>
                  <DialogDescription>Preencha as informações da aula</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Nome da aula"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrição da aula"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="module">Módulo</Label>
                    <Select value={formData.module_id} onValueChange={(value) => setFormData({ ...formData, module_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um módulo" />
                      </SelectTrigger>
                      <SelectContent>
                        {modules.map((module) => (
                          <SelectItem key={module.id} value={module.id}>
                            {module.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duração (minutos)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      placeholder="30"
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
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate}>Criar Aula</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Filtrar por módulo</Label>
            <Select value={filterModuleId} onValueChange={setFilterModuleId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma aula criada ainda
                  </TableCell>
                </TableRow>
              ) : (
                lessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="font-medium">{lesson.title}</TableCell>
                    <TableCell>{getModuleName(lesson.module_id)}</TableCell>
                    <TableCell>{lesson.duration_minutes ? `${lesson.duration_minutes} min` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={lesson.is_published ? "default" : "secondary"}>
                        {lesson.is_published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(lesson.id, lesson.is_published)}
                        >
                          {lesson.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(lesson)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteLessonId(lesson.id)}>
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
            <DialogTitle>Editar Aula</DialogTitle>
            <DialogDescription>Atualize as informações da aula</DialogDescription>
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
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-module">Módulo</Label>
              <Select value={formData.module_id} onValueChange={(value) => setFormData({ ...formData, module_id: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-duration">Duração (minutos)</Label>
              <Input
                id="edit-duration"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
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
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLessonId} onOpenChange={() => setDeleteLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.
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
