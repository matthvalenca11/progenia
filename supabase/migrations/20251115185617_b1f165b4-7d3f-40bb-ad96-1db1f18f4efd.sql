-- Expandir schema do banco de dados para plataforma completa

-- Criar enum para tipos de aula
CREATE TYPE lesson_type AS ENUM ('video', 'artigo', 'quiz', 'laboratorio_virtual');

-- Criar enum para papéis de usuário
CREATE TYPE user_role AS ENUM ('aluno', 'instrutor', 'admin');

-- Criar enum para status de progresso
CREATE TYPE progress_status AS ENUM ('nao_iniciado', 'em_progresso', 'concluido');

-- Criar enum para tipos de laboratório
CREATE TYPE lab_type AS ENUM ('mri_viewer', 'ultrassom_simulador', 'eletroterapia_sim', 'termico_sim');

-- Expandir tabela de perfis com mais campos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cargo TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS papel user_role DEFAULT 'aluno';

-- Criar índice para papel
CREATE INDEX IF NOT EXISTS idx_profiles_papel ON public.profiles(papel);

-- Atualizar trigger para definir papel inicial
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir perfil
  INSERT INTO public.profiles (id, full_name, papel)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    'aluno'
  );
  
  -- Inserir role padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student');
  
  -- Inserir stats
  INSERT INTO public.user_stats (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabela de progresso detalhado por aula
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status progress_status DEFAULT 'nao_iniciado',
  tempo_gasto_minutos INTEGER DEFAULT 0,
  ultima_posicao_video INTEGER DEFAULT 0,
  quiz_score NUMERIC,
  quiz_tentativas INTEGER DEFAULT 0,
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- RLS para lesson_progress
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio progresso"
ON public.lesson_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
ON public.lesson_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem modificar seu próprio progresso"
ON public.lesson_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todo progresso"
ON public.lesson_progress FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_status ON public.lesson_progress(status);

-- Tabela de conquistas/badges expandida
ALTER TABLE public.badges 
ADD COLUMN IF NOT EXISTS pontos_recompensa INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

-- Tabela de pontos detalhados
CREATE TABLE IF NOT EXISTS public.points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pontos INTEGER NOT NULL,
  origem TEXT NOT NULL, -- 'aula_concluida', 'modulo_concluido', 'quiz', 'streak', 'badge'
  origem_id UUID,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS para points_history
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio histórico"
ON public.points_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir pontos"
ON public.points_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todo histórico"
ON public.points_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Índice para histórico de pontos
CREATE INDEX IF NOT EXISTS idx_points_history_user ON public.points_history(user_id, created_at DESC);

-- Tabela de configurações de gamificação
CREATE TABLE IF NOT EXISTS public.gamification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao TEXT UNIQUE NOT NULL, -- 'completar_aula', 'completar_modulo', 'quiz_100', etc
  pontos INTEGER NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir regras padrão
INSERT INTO public.gamification_rules (acao, pontos, descricao) VALUES
  ('completar_aula', 10, 'Pontos por completar uma aula'),
  ('completar_modulo', 50, 'Pontos por completar um módulo inteiro'),
  ('quiz_perfeito', 25, 'Pontos por acertar 100% de um quiz'),
  ('quiz_aprovado', 15, 'Pontos por passar em um quiz (>70%)'),
  ('streak_7_dias', 30, 'Pontos por 7 dias consecutivos'),
  ('streak_30_dias', 150, 'Pontos por 30 dias consecutivos')
ON CONFLICT (acao) DO NOTHING;

-- RLS para gamification_rules
ALTER TABLE public.gamification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver regras"
ON public.gamification_rules FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar regras"
ON public.gamification_rules FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Função para calcular nível baseado em XP
CREATE OR REPLACE FUNCTION public.calculate_level(total_xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Fórmula: level = floor(sqrt(xp / 100))
  RETURN FLOOR(SQRT(total_xp::NUMERIC / 100));
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gamification_rules_updated_at
  BEFORE UPDATE ON public.gamification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();