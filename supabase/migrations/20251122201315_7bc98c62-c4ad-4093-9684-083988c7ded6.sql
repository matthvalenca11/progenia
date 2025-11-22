-- Criar tabela para conteúdo da página Sobre
CREATE TABLE IF NOT EXISTS public.about_page_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Hero Section
  hero_title TEXT DEFAULT 'Sobre a ProGenia',
  hero_subtitle TEXT DEFAULT 'Democratizando o acesso ao conhecimento científico em saúde através de aprendizado interativo, simulações práticas e tecnologia de ponta.',
  
  -- Motivação & Problema
  motivation_title TEXT DEFAULT 'Por Que ProGenia Existe?',
  motivation_description TEXT DEFAULT 'Profissionais de saúde frequentemente utilizam tecnologias terapêuticas e diagnósticas sem compreender profundamente os princípios físicos e fisiológicos por trás delas.',
  motivation_challenges JSONB DEFAULT '["Lacunas na formação sobre física aplicada à saúde", "Riscos do uso inadequado de eletroterapias e equipamentos", "Recursos de treinamento limitados e fragmentados", "Dificuldade em visualizar conceitos abstratos"]'::jsonb,
  
  -- Nossa Solução
  solution_title TEXT DEFAULT 'Nossa Solução',
  solution_subtitle TEXT DEFAULT 'ProGenia oferece uma abordagem moderna e eficaz para o aprendizado científico em saúde',
  solution_features JSONB DEFAULT '[
    {"title": "Micro-Learning Estruturado", "description": "Conteúdo dividido em módulos curtos e focados, facilitando a absorção do conhecimento"},
    {"title": "Simulações Interativas", "description": "Laboratórios virtuais onde você pode experimentar e visualizar conceitos complexos"},
    {"title": "Aprendizado Personalizado", "description": "IA que acompanha seu progresso e sugere conteúdos baseados nas suas necessidades"}
  ]'::jsonb,
  
  -- Público-alvo
  audience_title TEXT DEFAULT 'Quem se Beneficia?',
  audience_subtitle TEXT DEFAULT 'ProGenia foi desenvolvido para profissionais e estudantes da área da saúde',
  audience_stats JSONB DEFAULT '[
    {"icon": "👨‍⚕️", "title": "Profissionais da Saúde no Brasil", "count": "300.000+", "subtitle": "Registrados no COFFITO"},
    {"icon": "🎓", "title": "Cursos de Graduação", "count": "600+", "subtitle": "Fisioterapia, Fonoaudiologia e TO"},
    {"icon": "🏥", "title": "Clínicas e centros de reabilitação física", "count": "20.000+", "subtitle": "Profissionais ativos"}
  ]'::jsonb,
  
  -- Seção Parceiros
  partners_title TEXT DEFAULT 'Nossos Parceiros',
  partners_subtitle TEXT DEFAULT 'Parceiros e apoiadores da nossa missão',
  
  -- Seção Equipe
  team_title TEXT DEFAULT 'Nossa Equipe',
  team_subtitle TEXT DEFAULT 'Especialistas dedicados a revolucionar a educação em saúde',
  
  -- CTA Final
  cta_title TEXT DEFAULT 'Pronto para Transformar Seu Aprendizado?',
  cta_subtitle TEXT DEFAULT 'Faça parte da nova geração de profissionais que dominam a ciência por trás da tecnologia médica'
);

-- Enable RLS
ALTER TABLE public.about_page_content ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver conteúdo da página Sobre"
  ON public.about_page_content
  FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem atualizar conteúdo da página Sobre"
  ON public.about_page_content
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem inserir conteúdo da página Sobre"
  ON public.about_page_content
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_about_page_content_updated_at
  BEFORE UPDATE ON public.about_page_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir conteúdo padrão
INSERT INTO public.about_page_content (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;