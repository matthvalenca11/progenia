import { useState, useEffect } from "react";
import { moduleService, Module } from "@/services/moduleService";
import { storageService } from "@/services/storageService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  BookOpen, 
  Eye, 
  EyeOff,
  ArrowUp,
  ArrowDown
} from "lucide-react";

export function ModulesManager() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    difficulty_level: "intermediate" as string,
    estimated_hours: 5,
    thumbnail_url: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const data = await moduleService.getAllModules();
      setModules(data);
    } catch (error: any) {
      toast.error("Erro ao carregar módulos", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (module?: Module) => {
    if (module) {
      setEditing(module.id);
      setFormData({
        title: module.title,
        description: module.description || "",
        category: module.category || "",
        difficulty_level: module.difficulty_level || "intermediate",
        estimated_hours: module.estimated_hours || 5,
        thumbnail_url: module.thumbnail_url || "",
      });
    } else {
      setEditing("new");
      setFormData({
        title: "",
        description: "",
        category: "",
        difficulty_level: "intermediate",
        estimated_hours: 5,
        thumbnail_url: "",
      });
    }
    setSelectedFile(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormData({
      title: "",
      description: "",
      category: "",
      difficulty_level: "intermediate",
      estimated_hours: 5,
      thumbnail_url: "",
    });
    setSelectedFile(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Campos obrigatórios", {
        description: "Preencha título e descrição",
      });
      return;
    }

    setUploading(true);
    try {
      let thumbnailUrl = formData.thumbnail_url;

      if (selectedFile) {
        const fileName = storageService.generateUniqueFileName(selectedFile.name);
        const result = await storageService.uploadFile({
          bucket: "public-marketing",
          path: `modules/${fileName}`,
          file: selectedFile,
        });
        thumbnailUrl = storageService.getPublicUrl("public-marketing", result.path);
      }

      const moduleData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category.trim(),
        difficulty_level: formData.difficulty_level,
        estimated_hours: formData.estimated_hours,
        thumbnail_url: thumbnailUrl || null,
      };

      if (editing === "new") {
        await moduleService.createModule({
          ...moduleData,
          order_index: modules.length,
          published: false,
        });
        toast.success("Módulo criado com sucesso");
      } else {
        await moduleService.updateModule(editing!, moduleData);
        toast.success("Módulo atualizado com sucesso");
      }

      loadModules();
      cancelEdit();
    } catch (error: any) {
      toast.error("Erro ao salvar", {
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${title}"?`)) return;

    try {
      await moduleService.deleteModule(id);
      toast.success("Módulo excluído");
      loadModules();
    } catch (error: any) {
      toast.error("Erro ao excluir", {
        description: error.message,
      });
    }
  };

  const handleTogglePublish = async (id: string, currentState: boolean) => {
    try {
      await moduleService.togglePublish(id, !currentState);
      toast.success(currentState ? "Módulo despublicado" : "Módulo publicado");
      loadModules();
    } catch (error: any) {
      toast.error("Erro ao atualizar", {
        description: error.message,
      });
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newModules = [...modules];
    [newModules[index], newModules[index - 1]] = [newModules[index - 1], newModules[index]];
    
    try {
      await moduleService.reorderModules(
        newModules.map((m, i) => ({ id: m.id, order_index: i }))
      );
      setModules(newModules);
      toast.success("Ordem atualizada");
    } catch (error: any) {
      toast.error("Erro ao reordenar");
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === modules.length - 1) return;
    const newModules = [...modules];
    [newModules[index], newModules[index + 1]] = [newModules[index + 1], newModules[index]];
    
    try {
      await moduleService.reorderModules(
        newModules.map((m, i) => ({ id: m.id, order_index: i }))
      );
      setModules(newModules);
      toast.success("Ordem atualizada");
    } catch (error: any) {
      toast.error("Erro ao reordenar");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Gerenciar Módulos
          </CardTitle>
          <Button onClick={() => startEdit()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Módulo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Fundamentos de Eletroterapia"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição *</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição detalhada do módulo"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Eletroterapia"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Duração (horas)</label>
                  <Input
                    type="number"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData({ ...formData, estimated_hours: parseInt(e.target.value) || 5 })}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nível de Dificuldade</label>
                <Select
                  value={formData.difficulty_level}
                  onValueChange={(value) => setFormData({ ...formData, difficulty_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Iniciante</SelectItem>
                    <SelectItem value="intermediate">Intermediário</SelectItem>
                    <SelectItem value="advanced">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Imagem de capa</label>
                <FileUploadField
                  accept="image/*"
                  onFilesSelected={(files) => setSelectedFile(files[0])}
                  label="Selecione uma imagem de capa"
                  description="JPG, PNG ou WEBP"
                  maxSize={5}
                />
                {formData.thumbnail_url && !selectedFile && (
                  <div className="mt-2">
                    <img
                      src={formData.thumbnail_url}
                      alt="Capa atual"
                      className="h-32 object-cover border rounded"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={uploading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {uploading ? "Salvando..." : "Salvar"}
                </Button>
                <Button onClick={cancelEdit} variant="outline" disabled={uploading}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {modules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum módulo cadastrado ainda
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module, index) => (
              <Card key={module.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {module.thumbnail_url && (
                      <img
                        src={module.thumbnail_url}
                        alt={module.title}
                        className="h-20 w-32 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium">{module.title}</h4>
                          {module.category && (
                            <Badge variant="outline" className="mt-1">
                              {module.category}
                            </Badge>
                          )}
                        </div>
                        <Badge variant={module.published ? "default" : "secondary"}>
                          {module.published ? "Publicado" : "Rascunho"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {module.description}
                      </p>
                      <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{module.difficulty_level}</span>
                        <span>•</span>
                        <span>{module.estimated_hours}h</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === modules.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(module.id, module.published || false)}
                        >
                          {module.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(module)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(module.id, module.title)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
