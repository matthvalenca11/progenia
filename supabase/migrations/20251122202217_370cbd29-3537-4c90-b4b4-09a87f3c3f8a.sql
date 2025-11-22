-- Criar tabela para seções dinâmicas da página Sobre
CREATE TABLE IF NOT EXISTS public.about_page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  section_type TEXT NOT NULL, -- 'hero', 'text', 'text_image', 'text_video', 'features', 'stats', 'cta'
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  
  -- Conteúdo
  title TEXT,
  subtitle TEXT,
  description TEXT,
  
  -- Mídia
  media_url TEXT, -- URL da imagem ou vídeo
  media_type TEXT, -- 'image' ou 'video'
  
  -- Dados estruturados (JSON) para seções complexas
  -- Para features: [{"title": "...", "description": "...", "icon": "..."}]
  -- Para stats: [{"icon": "...", "title": "...", "count": "...", "subtitle": "..."}]
  content_data JSONB DEFAULT '{}'::jsonb,
  
  -- Layout
  layout TEXT DEFAULT 'default' -- 'default', 'left', 'right', 'center', 'fullwidth'
);

-- Enable RLS
ALTER TABLE public.about_page_sections ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver seções publicadas"
  ON public.about_page_sections
  FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem gerenciar seções"
  ON public.about_page_sections
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_about_page_sections_updated_at
  BEFORE UPDATE ON public.about_page_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir seções padrão (mantendo o conteúdo atual)
INSERT INTO public.about_page_sections (section_type, order_index, title, subtitle, description, layout) VALUES
  ('hero', 1, 'Sobre a ProGenia', 'Democratizando o acesso ao conhecimento científico em saúde através de aprendizado interativo, simulações práticas e tecnologia de ponta.', NULL, 'center'),
  ('text_image', 2, 'Por Que ProGenia Existe?', NULL, 'Profissionais de saúde frequentemente utilizam tecnologias terapêuticas e diagnósticas sem compreender profundamente os princípios físicos e fisiológicos por trás delas.', 'left'),
  ('features', 3, 'Nossa Solução', 'ProGenia oferece uma abordagem moderna e eficaz para o aprendizado científico em saúde', NULL, 'default'),
  ('stats', 4, 'Quem se Beneficia?', 'ProGenia foi desenvolvido para profissionais e estudantes da área da saúde', NULL, 'default'),
  ('cta', 5, 'Pronto para Transformar Seu Aprendizado?', 'Faça parte da nova geração de profissionais que dominam a ciência por trás da tecnologia médica', NULL, 'center');