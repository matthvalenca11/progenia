-- Texto legal exibido no cadastro (termos de privacidade e uso)
CREATE TABLE IF NOT EXISTS public.legal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terms_privacy_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.legal_settings (id, terms_privacy_text)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'TERMOS DE PRIVACIDADE E USO - PROGENIA

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
Ao criar sua conta, você declara que leu e concorda com estes termos de privacidade e uso.'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.legal_settings ENABLE ROW LEVEL SECURITY;

-- Permite leitura pública (inclui usuários não autenticados na tela de cadastro)
CREATE POLICY "Public can read legal settings"
  ON public.legal_settings FOR SELECT
  TO public
  USING (true);

-- Apenas admins podem inserir/atualizar/deletar o texto legal
CREATE POLICY "Admins can manage legal settings"
  ON public.legal_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_legal_settings_updated_at ON public.legal_settings;
CREATE TRIGGER update_legal_settings_updated_at
BEFORE UPDATE ON public.legal_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
