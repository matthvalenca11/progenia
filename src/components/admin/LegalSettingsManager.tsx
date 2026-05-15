import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LEGAL_SETTINGS_ID = "00000000-0000-0000-0000-000000000002";

const defaultLegalText = `TERMOS DE PRIVACIDADE E USO - PROGENIA

1. Coleta e uso de dados
Coletamos dados cadastrais e de uso da plataforma para oferecer uma melhor experiência educacional.

2. Finalidade
Os dados são utilizados para autenticação, personalização do conteúdo, análises internas e comunicação com o usuário.

3. Compartilhamento
Não vendemos dados pessoais. O compartilhamento ocorre apenas quando necessário para operação da plataforma e em conformidade com a legislação.

4. Segurança
Adotamos medidas técnicas e administrativas para proteção das informações.

5. Direitos do titular
Você pode solicitar atualização, correção ou exclusão dos seus dados, conforme a legislação aplicável.

6. Aceite
Ao criar sua conta, você declara que leu e concorda com estes termos de privacidade e uso.`;

interface LegalSettingsManagerProps {
  onSaved?: () => void;
}

type DocumentType = "terms_of_use" | "privacy_policy" | "cookie_policy";

export const LegalSettingsManager = ({ onSaved }: LegalSettingsManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [termsPrivacyText, setTermsPrivacyText] = useState(defaultLegalText);
  const [termsOfUseText, setTermsOfUseText] = useState(defaultLegalText);
  const [privacyPolicyText, setPrivacyPolicyText] = useState(defaultLegalText);
  const [cookiePolicyText, setCookiePolicyText] = useState(
    "Esta política descreve o uso de cookies essenciais, analíticos e de preferências na plataforma ProGenia.",
  );
  const [termsVersion, setTermsVersion] = useState("v1");
  const [privacyVersion, setPrivacyVersion] = useState("v1");
  const [cookiesVersion, setCookiesVersion] = useState("v1");
  const [dpoContactEmail, setDpoContactEmail] = useState("contato@progenia.com.br");
  const [dpoContactChannel, setDpoContactChannel] = useState("Página de contato da ProGenia");

  useEffect(() => {
    void loadLegalSettings();
  }, []);

  const loadLegalSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("legal_settings")
        .select(
          "terms_privacy_text,terms_of_use_text,privacy_policy_text,cookie_policy_text,terms_version,privacy_version,cookies_version,dpo_contact_email,dpo_contact_channel",
        )
        .eq("id", LEGAL_SETTINGS_ID)
        .maybeSingle();

      if (error) throw error;
      if (data?.terms_privacy_text) {
        setTermsPrivacyText(data.terms_privacy_text);
      }
      if (data?.terms_of_use_text) setTermsOfUseText(data.terms_of_use_text);
      if (data?.privacy_policy_text) setPrivacyPolicyText(data.privacy_policy_text);
      if (data?.cookie_policy_text) setCookiePolicyText(data.cookie_policy_text);
      if (data?.terms_version) setTermsVersion(data.terms_version);
      if (data?.privacy_version) setPrivacyVersion(data.privacy_version);
      if (data?.cookies_version) setCookiesVersion(data.cookies_version);
      if (data?.dpo_contact_email) setDpoContactEmail(data.dpo_contact_email);
      if (data?.dpo_contact_channel) setDpoContactChannel(data.dpo_contact_channel);
    } catch (error) {
      console.error("Erro ao carregar texto legal:", error);
      toast.error("Erro ao carregar termos de privacidade e uso");
    } finally {
      setLoading(false);
    }
  };

  const upsertDocumentVersion = async (
    documentType: DocumentType,
    version: string,
    title: string,
    content: string,
  ) => {
    const { error } = await supabase.from("legal_documents").upsert(
      {
        document_type: documentType,
        language: "pt-BR",
        version,
        title,
        content,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "document_type,language,version" },
    );
    if (error) throw error;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("legal_settings")
        .upsert({
          id: LEGAL_SETTINGS_ID,
          terms_privacy_text: termsPrivacyText,
          terms_of_use_text: termsOfUseText,
          privacy_policy_text: privacyPolicyText,
          cookie_policy_text: cookiePolicyText,
          terms_version: termsVersion,
          privacy_version: privacyVersion,
          cookies_version: cookiesVersion,
          dpo_contact_email: dpoContactEmail,
          dpo_contact_channel: dpoContactChannel,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      await Promise.all([
        upsertDocumentVersion("terms_of_use", termsVersion, "Termos de Uso", termsOfUseText),
        upsertDocumentVersion("privacy_policy", privacyVersion, "Politica de Privacidade", privacyPolicyText),
        upsertDocumentVersion("cookie_policy", cookiesVersion, "Politica de Cookies", cookiePolicyText),
      ]);

      toast.success("Texto legal atualizado com sucesso!");
      onSaved?.();
    } catch (error: unknown) {
      console.error("Erro ao salvar texto legal:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Erro ao salvar termos de privacidade e uso";

      if (message.includes("relation") && message.includes("legal_settings")) {
        toast.error("Tabela legal_settings não existe. Rode: supabase db push");
        return;
      }

      toast.error(message);
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
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Termos de Privacidade e Uso</h2>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure documentos legais versionados e o canal de contato do DPO/LGPD exibido na plataforma.
        </AlertDescription>
      </Alert>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dpo-email">Email do DPO / canal LGPD</Label>
            <Input
              id="dpo-email"
              value={dpoContactEmail}
              onChange={(e) => setDpoContactEmail(e.target.value)}
              placeholder="dpo@empresa.com.br"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpo-channel">Canal de atendimento</Label>
            <Input
              id="dpo-channel"
              value={dpoContactChannel}
              onChange={(e) => setDpoContactChannel(e.target.value)}
              placeholder="URL, formulario ou central de atendimento"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="terms-version">Versao dos Termos de Uso</Label>
          <Input id="terms-version" value={termsVersion} onChange={(e) => setTermsVersion(e.target.value)} />
          <Label htmlFor="terms-text">Termos de Uso</Label>
          <Textarea
            id="terms-text"
            rows={12}
            value={termsOfUseText}
            onChange={(e) => setTermsOfUseText(e.target.value)}
            placeholder="Termos de uso..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privacy-version">Versao da Politica de Privacidade</Label>
          <Input id="privacy-version" value={privacyVersion} onChange={(e) => setPrivacyVersion(e.target.value)} />
          <Label htmlFor="privacy-text">Politica de Privacidade</Label>
          <Textarea
            id="privacy-text"
            rows={12}
            value={privacyPolicyText}
            onChange={(e) => setPrivacyPolicyText(e.target.value)}
            placeholder="Politica de privacidade..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cookies-version">Versao da Politica de Cookies</Label>
          <Input id="cookies-version" value={cookiesVersion} onChange={(e) => setCookiesVersion(e.target.value)} />
          <Label htmlFor="cookies-text">Politica de Cookies</Label>
          <Textarea
            id="cookies-text"
            rows={10}
            value={cookiePolicyText}
            onChange={(e) => setCookiePolicyText(e.target.value)}
            placeholder="Politica de cookies..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="terms-privacy-text">Texto legado (compatibilidade)</Label>
          <Textarea
            id="terms-privacy-text"
            rows={8}
            value={termsPrivacyText}
            onChange={(e) => setTermsPrivacyText(e.target.value)}
            placeholder="Texto legado para telas antigas..."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Texto"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
