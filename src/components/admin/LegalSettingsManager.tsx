import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

export const LegalSettingsManager = ({ onSaved }: LegalSettingsManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [termsPrivacyText, setTermsPrivacyText] = useState(defaultLegalText);

  useEffect(() => {
    void loadLegalSettings();
  }, []);

  const loadLegalSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("legal_settings")
        .select("terms_privacy_text")
        .eq("id", LEGAL_SETTINGS_ID)
        .maybeSingle();

      if (error) throw error;
      if (data?.terms_privacy_text) {
        setTermsPrivacyText(data.terms_privacy_text);
      }
    } catch (error) {
      console.error("Erro ao carregar texto legal:", error);
      toast.error("Erro ao carregar termos de privacidade e uso");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("legal_settings")
        .upsert({
          id: LEGAL_SETTINGS_ID,
          terms_privacy_text: termsPrivacyText,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
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
          Este texto é exibido no cadastro quando o usuário clica em “termos de privacidade e uso”.
        </AlertDescription>
      </Alert>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="terms-privacy-text">Texto completo</Label>
          <Textarea
            id="terms-privacy-text"
            rows={18}
            value={termsPrivacyText}
            onChange={(e) => setTermsPrivacyText(e.target.value)}
            placeholder="Digite aqui os termos de privacidade e uso..."
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
