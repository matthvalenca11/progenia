import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { storageService } from "@/services/storageService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Save, X, Users } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photo_url: string | null;
  ordem: number | null;
}

export function TeamManager() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    bio: "",
    photo_url: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar equipe",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (member?: TeamMember) => {
    if (member) {
      setEditing(member.id);
      setFormData({
        name: member.name,
        role: member.role,
        bio: member.bio || "",
        photo_url: member.photo_url || "",
      });
    } else {
      setEditing("new");
      setFormData({
        name: "",
        role: "",
        bio: "",
        photo_url: "",
      });
    }
    setSelectedFile(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormData({
      name: "",
      role: "",
      bio: "",
      photo_url: "",
    });
    setSelectedFile(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.role.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, informe nome e cargo",
      });
      return;
    }

    setUploading(true);
    try {
      let photoUrl = formData.photo_url;

      if (selectedFile) {
        const fileName = storageService.generateUniqueFileName(selectedFile.name);
        const result = await storageService.uploadFile({
          bucket: "team-photos",
          path: fileName,
          file: selectedFile,
        });
        photoUrl = storageService.getPublicUrl("team-photos", result.path);
      }

      const memberData = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        bio: formData.bio.trim() || null,
        photo_url: photoUrl || null,
      };

      if (editing === "new") {
        const { error } = await supabase
          .from("team_members")
          .insert(memberData);
        if (error) throw error;
        toast({
          title: "Membro adicionado",
          description: "O membro da equipe foi adicionado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("team_members")
          .update(memberData)
          .eq("id", editing);
        if (error) throw error;
        toast({
          title: "Membro atualizado",
          description: "As alterações foram salvas com sucesso",
        });
      }

      loadMembers();
      cancelEdit();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover "${name}" da equipe?`)) return;

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Membro removido",
        description: "O membro foi removido da equipe com sucesso",
      });
      loadMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error.message,
      });
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
            <Users className="h-5 w-5" />
            Gerenciar Equipe
          </CardTitle>
          <Button onClick={() => startEdit()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Membro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cargo *</label>
                <Input
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Ex: Fundador, Fisioterapeuta, Coordenador"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mini Bio</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Breve descrição sobre o membro"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Foto</label>
                <FileUploadField
                  accept="image/*"
                  onFilesSelected={(files) => setSelectedFile(files[0])}
                  label="Selecione a foto do membro"
                  description="Formatos: JPG, PNG. Ideal: quadrada."
                  maxSize={5}
                />
                {formData.photo_url && !selectedFile && (
                  <div className="mt-2 flex justify-center">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={formData.photo_url} />
                      <AvatarFallback>
                        {formData.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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

        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum membro da equipe cadastrado ainda
          </div>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 flex-shrink-0">
                      <AvatarImage src={member.photo_url || undefined} />
                      <AvatarFallback>
                        {member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{member.name}</h4>
                      <p className="text-sm text-primary">{member.role}</p>
                      {member.bio && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {member.bio}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(member)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(member.id, member.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
