-- Cache persistente de traduções
CREATE TABLE IF NOT EXISTS public.translation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  source_text text NOT NULL,
  translated_text text NOT NULL,
  usage_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_lang, target_lang, source_text)
);

-- Glossário customizado para termos técnicos
CREATE TABLE IF NOT EXISTS public.translation_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  source_text text NOT NULL,
  target_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_lang, target_lang, source_text)
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON public.translation_cache (source_lang, target_lang, source_text);

CREATE INDEX IF NOT EXISTS idx_translation_glossary_lookup
  ON public.translation_glossary (source_lang, target_lang, is_active, priority);

ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_glossary ENABLE ROW LEVEL SECURITY;

-- Somente admin autenticado pode ler/escrever glossário
CREATE POLICY "Admins can manage translation glossary"
  ON public.translation_glossary
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Opcionalmente, admins podem visualizar o cache (diagnóstico)
CREATE POLICY "Admins can read translation cache"
  ON public.translation_cache
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
DROP TRIGGER IF EXISTS update_translation_cache_updated_at ON public.translation_cache;
CREATE TRIGGER update_translation_cache_updated_at
BEFORE UPDATE ON public.translation_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_translation_glossary_updated_at ON public.translation_glossary;
CREATE TRIGGER update_translation_glossary_updated_at
BEFORE UPDATE ON public.translation_glossary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial do glossário médico PT -> EN
INSERT INTO public.translation_glossary (source_lang, target_lang, source_text, target_text, priority)
VALUES
  ('pt', 'en', 'cápsula', 'capsule', 10),
  ('pt', 'en', 'cápsulas', 'capsules', 10),
  ('pt', 'en', 'aula', 'lesson', 10),
  ('pt', 'en', 'aulas', 'lessons', 10),
  ('pt', 'en', 'ultrassom', 'ultrasound', 10),
  ('pt', 'en', 'físico médico', 'medical physicist', 10),
  ('pt', 'en', 'engenheiro biomédico', 'biomedical engineer', 10),
  ('pt', 'en', 'biomédico', 'biomedical scientist', 10),
  ('pt', 'en', 'eletroterapia', 'electrotherapy', 10),
  ('pt', 'en', 'ressonância magnética', 'magnetic resonance imaging', 10)
ON CONFLICT (source_lang, target_lang, source_text) DO NOTHING;
