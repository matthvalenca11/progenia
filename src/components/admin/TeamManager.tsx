import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { storageService } from "@/services/storageService";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  order_index: number;
}

export const TeamManager = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", role: "", photo_url: "" });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar membros da equipe");
      return;
    }

    setMembers(data || []);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const result = await storageService.uploadFile({
        bucket: "team-photos",
        path: `team/${Date.now()}-${file.name}`,
        file,
      });

      const photoUrl = storageService.getPublicUrl("team-photos", result.path);
      setNewMember({ ...newMember, photo_url: photoUrl });
      toast.success("Foto enviada com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.role) {
      toast.error("Preencha nome e cargo");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("team_members").insert({
      name: newMember.name,
      role: newMember.role,
      photo_url: newMember.photo_url || null,
      order_index: members.length,
    });

    if (error) {
      toast.error("Erro ao adicionar membro");
    } else {
      toast.success("Membro adicionado!");
      setNewMember({ name: "", role: "", photo_url: "" });
      loadMembers();
    }
    setLoading(false);
  };

  const handleDeleteMember = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao deletar membro");
    } else {
      toast.success("Membro deletado!");
      loadMembers();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Membro da Equipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="member-name">Nome</Label>
              <Input
                id="member-name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="Nome do membro"
              />
            </div>
            <div>
              <Label htmlFor="member-role">Formação / Cargo</Label>
              <Input
                id="member-role"
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                placeholder="Ex: Fisioterapeuta, Coordenador"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="member-photo">Foto do Membro</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="member-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
              {newMember.photo_url && (
                <img src={newMember.photo_url} alt="Preview" className="h-12 w-12 object-cover rounded" />
              )}
            </div>
          </div>

          <Button onClick={handleAddMember} disabled={loading || uploadingPhoto}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Membro
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  {member.photo_url && (
                    <img src={member.photo_url} alt={member.name} className="h-16 w-16 object-cover rounded" />
                  )}
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteMember(member.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-muted-foreground text-center py-4">Nenhum membro cadastrado</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
