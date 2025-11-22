import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { storageService } from "@/services/storageService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  order_index: number;
}

interface Partner {
  id: string;
  name: string;
  description: string | null;
  logo_url: string;
  website_url: string;
  order_index: number;
}

export const AboutManager = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingPartner, setLoadingPartner] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", role: "", photo_url: "" });
  const [newPartner, setNewPartner] = useState({ name: "", description: "", logo_url: "", website_url: "" });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadMembers();
    loadPartners();
  }, []);

  // Team Members Functions
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

    setLoadingTeam(true);
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
    setLoadingTeam(false);
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

  // Partners Functions
  const loadPartners = async () => {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar parceiros");
      return;
    }

    setPartners(data || []);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const result = await storageService.uploadFile({
        bucket: "partner-logos",
        path: `partners/${Date.now()}-${file.name}`,
        file,
      });

      const logoUrl = storageService.getPublicUrl("partner-logos", result.path);
      setNewPartner({ ...newPartner, logo_url: logoUrl });
      toast.success("Logo enviado com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.logo_url || !newPartner.website_url || !newPartner.description) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoadingPartner(true);
    const { error } = await supabase.from("partners").insert({
      name: newPartner.name,
      description: newPartner.description,
      logo_url: newPartner.logo_url,
      website_url: newPartner.website_url,
      order_index: partners.length,
    });

    if (error) {
      toast.error("Erro ao adicionar parceiro");
    } else {
      toast.success("Parceiro adicionado!");
      setNewPartner({ name: "", description: "", logo_url: "", website_url: "" });
      loadPartners();
    }
    setLoadingPartner(false);
  };

  const handleDeletePartner = async (id: string) => {
    const { error } = await supabase.from("partners").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao deletar parceiro");
    } else {
      toast.success("Parceiro deletado!");
      loadPartners();
    }
  };

  return (
    <Tabs defaultValue="team" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="team">Equipe</TabsTrigger>
        <TabsTrigger value="partners">Parceiros</TabsTrigger>
      </TabsList>

      <TabsContent value="team" className="space-y-6 mt-6">
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

            <Button onClick={handleAddMember} disabled={loadingTeam || uploadingPhoto}>
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
      </TabsContent>

      <TabsContent value="partners" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Parceiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="partner-name">Nome do Parceiro (sigla)</Label>
                <Input
                  id="partner-name"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  placeholder="Ex: UNIFESP, USP"
                />
              </div>
              <div>
                <Label htmlFor="partner-website">Site do Parceiro</Label>
                <Input
                  id="partner-website"
                  value={newPartner.website_url}
                  onChange={(e) => setNewPartner({ ...newPartner, website_url: e.target.value })}
                  placeholder="https://exemplo.com.br"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="partner-description">Nome Completo / Descrição</Label>
              <Input
                id="partner-description"
                value={newPartner.description}
                onChange={(e) => setNewPartner({ ...newPartner, description: e.target.value })}
                placeholder="Ex: Universidade Federal de São Paulo"
              />
            </div>

            <div>
              <Label htmlFor="partner-logo">Logo do Parceiro</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="partner-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
                {newPartner.logo_url && (
                  <img src={newPartner.logo_url} alt="Preview" className="h-12 w-12 object-contain" />
                )}
              </div>
            </div>

            <Button onClick={handleAddPartner} disabled={loadingPartner || uploadingLogo}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Parceiro
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parceiros Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <div key={partner.id} className="border rounded p-4 space-y-2">
                  <img src={partner.logo_url} alt={partner.name} className="h-20 w-full object-contain" />
                  <div className="text-center">
                    <p className="font-medium">{partner.name}</p>
                    {partner.description && (
                      <p className="text-sm text-muted-foreground mt-1">{partner.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <a href={partner.website_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Site
                      </a>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeletePartner(partner.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {partners.length === 0 && (
                <p className="text-muted-foreground text-center py-4 col-span-full">Nenhum parceiro cadastrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
