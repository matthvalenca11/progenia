import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { storageService } from "@/services/storageService";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Save, X, Handshake } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  ordem: number | null;
}

export function PartnersManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website_url: "",
    logo_url: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      setPartners(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar parceiros",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (partner?: Partner) => {
    if (partner) {
      setEditing(partner.id);
      setFormData({
        name: partner.name,
        description: partner.description || "",
        website_url: partner.website_url || "",
        logo_url: partner.logo_url || "",
      });
    } else {
      setEditing("new");
      setFormData({
        name: "",
        description: "",
        website_url: "",
        logo_url: "",
      });
    }
    setSelectedFile(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormData({
      name: "",
      description: "",
      website_url: "",
      logo_url: "",
    });
    setSelectedFile(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do parceiro",
      });
      return;
    }

    setUploading(true);
    try {
      let logoUrl = formData.logo_url;

      if (selectedFile) {
        const fileName = storageService.generateUniqueFileName(selectedFile.name);
        const result = await storageService.uploadFile({
          bucket: "partner-logos",
          path: fileName,
          file: selectedFile,
        });
        logoUrl = storageService.getPublicUrl("partner-logos", result.path);
      }

      const partnerData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        website_url: formData.website_url.trim() || null,
        logo_url: logoUrl || null,
      };

      if (editing === "new") {
        const { error } = await supabase
          .from("partners")
          .insert(partnerData);
        if (error) throw error;
        toast({
          title: "Parceiro criado",
          description: "O parceiro foi adicionado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("partners")
          .update(partnerData)
          .eq("id", editing);
        if (error) throw error;
        toast({
          title: "Parceiro atualizado",
          description: "As alterações foram salvas com sucesso",
        });
      }

      loadPartners();
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
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from("partners")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Parceiro excluído",
        description: "O parceiro foi removido com sucesso",
      });
      loadPartners();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
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
            <Handshake className="h-5 w-5" />
            Gerenciar Parceiros & Apoiadores
          </CardTitle>
          <Button onClick={() => startEdit()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Parceiro
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
                  placeholder="Nome do parceiro"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição sobre o parceiro"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Website</label>
                <Input
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Logo</label>
                <FileUploadField
                  accept="image/*"
                  onFilesSelected={(files) => setSelectedFile(files[0])}
                  label="Selecione o logo do parceiro"
                  description="Formatos: JPG, PNG, SVG"
                  maxSize={5}
                />
                {formData.logo_url && !selectedFile && (
                  <div className="mt-2">
                    <img
                      src={formData.logo_url}
                      alt="Logo atual"
                      className="h-20 object-contain border rounded p-2"
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

        {partners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum parceiro cadastrado ainda
          </div>
        ) : (
          <div className="grid gap-3">
            {partners.map((partner) => (
              <Card key={partner.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {partner.logo_url && (
                      <img
                        src={partner.logo_url}
                        alt={partner.name}
                        className="h-16 w-16 object-contain border rounded p-1 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{partner.name}</h4>
                      {partner.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {partner.description}
                        </p>
                      )}
                      {partner.website_url && (
                        <a
                          href={partner.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-1 inline-block"
                        >
                          Visitar website
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(partner)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(partner.id, partner.name)}
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
