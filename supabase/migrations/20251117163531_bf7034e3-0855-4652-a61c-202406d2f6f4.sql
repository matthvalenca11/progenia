-- Criar tabela de cápsulas
CREATE TABLE public.capsulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  pergunta_gatilho TEXT NOT NULL,
  texto_curto TEXT NOT NULL,
  takeaway TEXT NOT NULL,
  tipo_visual TEXT NOT NULL CHECK (tipo_visual IN ('imagem', 'video', 'lab')),
  visual_path TEXT,
  tipo_lab TEXT CHECK (tipo_lab IN ('mri_viewer', 'ultrasound_simulator', 'eletroterapia_lab', 'thermal_lab')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de perguntas do micro-quiz
CREATE TABLE public.capsula_quiz_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsula_id UUID NOT NULL REFERENCES public.capsulas(id) ON DELETE CASCADE,
  enunciado TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'unica' CHECK (tipo IN ('unica', 'multipla')),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de alternativas do micro-quiz
CREATE TABLE public.capsula_quiz_alternativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id UUID NOT NULL REFERENCES public.capsula_quiz_perguntas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  correta BOOLEAN NOT NULL DEFAULT false,
  ordem_base INTEGER NOT NULL DEFAULT 0,
  micro_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de progresso do usuário nas cápsulas
CREATE TABLE public.capsula_progresso_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capsula_id UUID NOT NULL REFERENCES public.capsulas(id) ON DELETE CASCADE,
  concluida BOOLEAN NOT NULL DEFAULT false,
  acertos_quiz INTEGER NOT NULL DEFAULT 0,
  tentativas INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, capsula_id)
);

-- Índices para melhor performance
CREATE INDEX idx_capsulas_modulo ON public.capsulas(modulo_id);
CREATE INDEX idx_capsulas_ordem ON public.capsulas(ordem);
CREATE INDEX idx_capsula_quiz_perguntas_capsula ON public.capsula_quiz_perguntas(capsula_id);
CREATE INDEX idx_capsula_quiz_alternativas_pergunta ON public.capsula_quiz_alternativas(pergunta_id);
CREATE INDEX idx_capsula_progresso_usuario ON public.capsula_progresso_usuario(usuario_id, capsula_id);

-- Trigger para atualizar updated_at nas cápsulas
CREATE TRIGGER update_capsulas_updated_at
  BEFORE UPDATE ON public.capsulas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para atualizar updated_at no progresso
CREATE TRIGGER update_capsula_progresso_updated_at
  BEFORE UPDATE ON public.capsula_progresso_usuario
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS policies para cápsulas
ALTER TABLE public.capsulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar cápsulas"
  ON public.capsulas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver cápsulas ativas de módulos publicados"
  ON public.capsulas
  FOR SELECT
  USING (
    ativo = true AND
    EXISTS (
      SELECT 1 FROM public.modules
      WHERE modules.id = capsulas.modulo_id
      AND modules.published = true
    )
  );

-- RLS policies para perguntas do quiz
ALTER TABLE public.capsula_quiz_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar perguntas"
  ON public.capsula_quiz_perguntas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver perguntas de cápsulas ativas"
  ON public.capsula_quiz_perguntas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capsulas
      WHERE capsulas.id = capsula_quiz_perguntas.capsula_id
      AND capsulas.ativo = true
    )
  );

-- RLS policies para alternativas
ALTER TABLE public.capsula_quiz_alternativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar alternativas"
  ON public.capsula_quiz_alternativas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver alternativas"
  ON public.capsula_quiz_alternativas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capsula_quiz_perguntas
      JOIN public.capsulas ON capsulas.id = capsula_quiz_perguntas.capsula_id
      WHERE capsula_quiz_perguntas.id = capsula_quiz_alternativas.pergunta_id
      AND capsulas.ativo = true
    )
  );

-- RLS policies para progresso do usuário
ALTER TABLE public.capsula_progresso_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio progresso"
  ON public.capsula_progresso_usuario
  FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem inserir seu próprio progresso"
  ON public.capsula_progresso_usuario
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
  ON public.capsula_progresso_usuario
  FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Admins podem ver todo progresso"
  ON public.capsula_progresso_usuario
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));