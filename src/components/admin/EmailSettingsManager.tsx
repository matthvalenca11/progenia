import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const EmailSettingsManager = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    default_from_email: "",
    verification_from_email: "",
    reset_from_email: "",
    verification_subject: "Confirme seu e-mail – ProGenia",
    reset_subject: "Redefinição de senha – ProGenia",
    verification_body_intro: "Olá! Bem-vindo(a) à plataforma ProGenia. Clique no botão abaixo para confirmar seu e-mail.",
    reset_body_intro: "Você solicitou a redefinição de senha na plataforma. Se não foi você, ignore este e-mail.",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_settings")
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          default_from_email: data.default_from_email || "",
          verification_from_email: data.verification_from_email || "",
          reset_from_email: data.reset_from_email || "",
          verification_subject: data.verification_subject || "Confirme seu e-mail – ProGenia",
          reset_subject: data.reset_subject || "Redefinição de senha – ProGenia",
          verification_body_intro: data.verification_body_intro || "Olá! Bem-vindo(a) à plataforma ProGenia. Clique no botão abaixo para confirmar seu e-mail.",
          reset_body_intro: data.reset_body_intro || "Você solicitou a redefinição de senha na plataforma. Se não foi você, ignore este e-mail.",
        });
      }
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("email_settings")
        .update(settings)
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Configurações de E-mail (Autenticação)</h2>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure os endereços de e-mail e mensagens usadas nos e-mails de autenticação. 
          Se um campo específico não for preenchido, o sistema usará o remetente padrão.
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Remetentes</h3>
            
            <div>
              <Label htmlFor="default_from">Remetente Padrão</Label>
              <Input
                id="default_from"
                type="email"
                placeholder="no-reply@progenia.com"
                value={settings.default_from_email}
                onChange={(e) => setSettings({ ...settings, default_from_email: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Usado como fallback para todos os e-mails
              </p>
            </div>

            <div>
              <Label htmlFor="verification_from">Remetente para Verificação de Cadastro</Label>
              <Input
                id="verification_from"
                type="email"
                placeholder="Deixe vazio para usar o padrão"
                value={settings.verification_from_email}
                onChange={(e) => setSettings({ ...settings, verification_from_email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="reset_from">Remetente para Recuperação de Senha</Label>
              <Input
                id="reset_from"
                type="email"
                placeholder="Deixe vazio para usar o padrão"
                value={settings.reset_from_email}
                onChange={(e) => setSettings({ ...settings, reset_from_email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">E-mail de Verificação de Cadastro</h3>
            
            <div>
              <Label htmlFor="verification_subject">Assunto</Label>
              <Input
                id="verification_subject"
                value={settings.verification_subject}
                onChange={(e) => setSettings({ ...settings, verification_subject: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="verification_body">Texto Introdutório</Label>
              <Textarea
                id="verification_body"
                rows={3}
                value={settings.verification_body_intro}
                onChange={(e) => setSettings({ ...settings, verification_body_intro: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Este texto aparecerá no início do e-mail, antes do botão de confirmação
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">E-mail de Recuperação de Senha</h3>
            
            <div>
              <Label htmlFor="reset_subject">Assunto</Label>
              <Input
                id="reset_subject"
                value={settings.reset_subject}
                onChange={(e) => setSettings({ ...settings, reset_subject: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="reset_body">Texto Introdutório</Label>
              <Textarea
                id="reset_body"
                rows={3}
                value={settings.reset_body_intro}
                onChange={(e) => setSettings({ ...settings, reset_body_intro: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Este texto aparecerá no início do e-mail, antes do botão de redefinição
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
