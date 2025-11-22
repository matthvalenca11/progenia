import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { storageService } from "@/services/storageService";

interface Partner {
  id: string;
  name: string;
  logo_url: string;
  website_url: string;
  order_index: number;
}

export const PartnersManager = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: "", logo_url: "", website_url: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadPartners();
  }, []);

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
    if (!newPartner.name || !newPartner.logo_url || !newPartner.website_url) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("partners").insert({
      name: newPartner.name,
      logo_url: newPartner.logo_url,
      website_url: newPartner.website_url,
      order_index: partners.length,
    });

    if (error) {
      toast.error("Erro ao adicionar parceiro");
    } else {
      toast.success("Parceiro adicionado!");
      setNewPartner({ name: "", logo_url: "", website_url: "" });
      loadPartners();
    }
    setLoading(false);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Parceiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="partner-name">Nome do Parceiro</Label>
              <Input
                id="partner-name"
                value={newPartner.name}
                onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                placeholder="Nome da empresa"
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

          <Button onClick={handleAddPartner} disabled={loading || uploadingLogo}>
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
                <p className="font-medium text-center">{partner.name}</p>
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
    </div>
  );
};
