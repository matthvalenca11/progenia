-- Criar tabela de cápsulas (conteúdos curtos e rápidos)
CREATE TABLE public.capsulas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_data JSONB DEFAULT '{"blocks": []}',
  module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT false,
  duration_minutes INTEGER,
  order_index INTEGER,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.capsulas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver cápsulas publicadas"
ON public.capsulas
FOR SELECT
USING (is_published = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem criar cápsulas"
ON public.capsulas
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar cápsulas"
ON public.capsulas
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem deletar cápsulas"
ON public.capsulas
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_capsulas_updated_at
BEFORE UPDATE ON public.capsulas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de progresso de cápsulas
CREATE TABLE public.capsula_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsula_id UUID NOT NULL REFERENCES public.capsulas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'nao_iniciado',
  data_conclusao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(capsula_id, user_id)
);

-- Habilitar RLS para progresso
ALTER TABLE public.capsula_progress ENABLE ROW LEVEL SECURITY;

-- Políticas para progresso
CREATE POLICY "Usuários podem ver seu próprio progresso"
ON public.capsula_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio progresso"
ON public.capsula_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
ON public.capsula_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para updated_at do progresso
CREATE TRIGGER update_capsula_progress_updated_at
BEFORE UPDATE ON public.capsula_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();