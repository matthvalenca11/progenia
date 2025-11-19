-- Quiz System - Complete Database Schema

-- 1. STRUCTURAL LAYER

-- Main quiz configuration table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aula_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  nota_minima_aprovacao INTEGER NOT NULL DEFAULT 70,
  tentativas_maximas INTEGER NOT NULL DEFAULT 3,
  tempo_limite_segundos INTEGER, -- NULL = sem limite
  modo_de_navegacao TEXT NOT NULL DEFAULT 'livre' CHECK (modo_de_navegacao IN ('livre', 'sequencial')),
  aleatorizar_ordem_perguntas BOOLEAN NOT NULL DEFAULT false,
  aleatorizar_ordem_alternativas BOOLEAN NOT NULL DEFAULT true,
  feedback_imediato BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quiz questions table
CREATE TABLE public.quiz_perguntas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  enunciado TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'unica' CHECK (tipo IN ('unica', 'multipla', 'dissertativa-curta')),
  nivel_dificuldade TEXT NOT NULL DEFAULT 'medio' CHECK (nivel_dificuldade IN ('facil', 'medio', 'dificil')),
  tags TEXT[] DEFAULT '{}',
  ordem INTEGER NOT NULL,
  imagem_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Answer options table
CREATE TABLE public.quiz_alternativas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pergunta_id UUID NOT NULL REFERENCES public.quiz_perguntas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  correta BOOLEAN NOT NULL DEFAULT false,
  explicacao_feedback TEXT,
  ordem_base INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quiz attempts table
CREATE TABLE public.quiz_tentativas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  numero_tentativa INTEGER NOT NULL,
  pontuacao_percentual NUMERIC NOT NULL,
  acertos INTEGER NOT NULL,
  erros INTEGER NOT NULL,
  aprovado BOOLEAN NOT NULL,
  tempo_gasto_segundos INTEGER,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual question answers in each attempt
CREATE TABLE public.quiz_tentativa_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tentativa_id UUID NOT NULL REFERENCES public.quiz_tentativas(id) ON DELETE CASCADE,
  pergunta_id UUID NOT NULL REFERENCES public.quiz_perguntas(id) ON DELETE CASCADE,
  alternativa_id_escolhida UUID REFERENCES public.quiz_alternativas(id) ON DELETE SET NULL,
  resposta_texto TEXT, -- for dissertativa-curta
  correta BOOLEAN NOT NULL,
  tempo_resposta_segundos INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. ANALYTICAL LAYER (INNOVATIVE)

-- User performance metrics per quiz
CREATE TABLE public.quiz_metricas_usuario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  media_tempo_resposta NUMERIC,
  media_acerto_por_dificuldade JSONB DEFAULT '{"facil": 0, "medio": 0, "dificil": 0}'::jsonb,
  topicos_dificeis TEXT[] DEFAULT '{}',
  taxa_evolucao NUMERIC DEFAULT 0 CHECK (taxa_evolucao >= 0 AND taxa_evolucao <= 1),
  total_tentativas INTEGER DEFAULT 0,
  melhor_pontuacao NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);

-- Personalized recommendations for students
CREATE TABLE public.quiz_recomendacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  recomendacao_gerada TEXT NOT NULL,
  topicos_revisar TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_quizzes_aula ON public.quizzes(aula_id);
CREATE INDEX idx_quiz_perguntas_quiz ON public.quiz_perguntas(quiz_id);
CREATE INDEX idx_quiz_alternativas_pergunta ON public.quiz_alternativas(pergunta_id);
CREATE INDEX idx_quiz_tentativas_usuario ON public.quiz_tentativas(usuario_id, quiz_id);
CREATE INDEX idx_quiz_tentativas_quiz ON public.quiz_tentativas(quiz_id);
CREATE INDEX idx_quiz_tentativa_respostas_tentativa ON public.quiz_tentativa_respostas(tentativa_id);
CREATE INDEX idx_quiz_metricas_usuario ON public.quiz_metricas_usuario(user_id, quiz_id);
CREATE INDEX idx_quiz_recomendacoes_usuario ON public.quiz_recomendacoes(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_metricas_updated_at
  BEFORE UPDATE ON public.quiz_metricas_usuario
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Quizzes
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar quizzes"
  ON public.quizzes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver quizzes ativos de aulas publicadas"
  ON public.quizzes FOR SELECT
  USING (
    ativo = true AND
    EXISTS (
      SELECT 1 FROM public.lessons
      WHERE lessons.id = quizzes.aula_id AND lessons.published = true
    )
  );

-- Quiz perguntas
ALTER TABLE public.quiz_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar perguntas"
  ON public.quiz_perguntas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver perguntas de quizzes ativos"
  ON public.quiz_perguntas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = quiz_perguntas.quiz_id AND quizzes.ativo = true
    )
  );

-- Quiz alternativas
ALTER TABLE public.quiz_alternativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar alternativas"
  ON public.quiz_alternativas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver alternativas"
  ON public.quiz_alternativas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_perguntas
      JOIN public.quizzes ON quizzes.id = quiz_perguntas.quiz_id
      WHERE quiz_perguntas.id = quiz_alternativas.pergunta_id
      AND quizzes.ativo = true
    )
  );

-- Quiz tentativas
ALTER TABLE public.quiz_tentativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem inserir suas tentativas"
  ON public.quiz_tentativas FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem ver suas tentativas"
  ON public.quiz_tentativas FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Admins podem ver todas tentativas"
  ON public.quiz_tentativas FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz tentativa respostas
ALTER TABLE public.quiz_tentativa_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem inserir respostas de suas tentativas"
  ON public.quiz_tentativa_respostas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_tentativas
      WHERE quiz_tentativas.id = quiz_tentativa_respostas.tentativa_id
      AND quiz_tentativas.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem ver respostas de suas tentativas"
  ON public.quiz_tentativa_respostas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_tentativas
      WHERE quiz_tentativas.id = quiz_tentativa_respostas.tentativa_id
      AND quiz_tentativas.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem ver todas respostas"
  ON public.quiz_tentativa_respostas FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz métricas
ALTER TABLE public.quiz_metricas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas métricas"
  ON public.quiz_metricas_usuario FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode atualizar métricas"
  ON public.quiz_metricas_usuario FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas métricas"
  ON public.quiz_metricas_usuario FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz recomendações
ALTER TABLE public.quiz_recomendacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas recomendações"
  ON public.quiz_recomendacoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode criar recomendações"
  ON public.quiz_recomendacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas recomendações"
  ON public.quiz_recomendacoes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- New badges for quiz system
INSERT INTO public.badges (name, description, icon, categoria, ordem, pontos_recompensa, criteria)
VALUES
  ('Primeiro Quiz Concluído', 'Complete seu primeiro quiz com sucesso', '🎯', 'quiz', 50, 50, '{"tipo": "primeiro_quiz"}'::jsonb),
  ('Mestre do Tempo', 'Complete um quiz em tempo recorde', '⚡', 'quiz', 51, 100, '{"tipo": "tempo_recorde"}'::jsonb),
  ('Persistência', 'Seja aprovado na segunda tentativa após reprovar', '💪', 'quiz', 52, 75, '{"tipo": "persistencia"}'::jsonb),
  ('Perfeccionista', 'Obtenha 100% de acertos em um quiz', '🌟', 'quiz', 53, 150, '{"tipo": "perfeccionista"}'::jsonb),
  ('Especialista em RM', 'Domine os quizzes de Ressonância Magnética', '🧲', 'quiz', 54, 200, '{"tipo": "especialista_rm"}'::jsonb);

-- Update gamification rules for quiz (use ON CONFLICT to avoid duplicates)
INSERT INTO public.gamification_rules (acao, descricao, pontos, ativo)
VALUES
  ('quiz_acerto_facil', 'Acerto em questão fácil', 5, true),
  ('quiz_acerto_medio', 'Acerto em questão média', 10, true),
  ('quiz_acerto_dificil', 'Acerto em questão difícil', 15, true),
  ('quiz_aprovado', 'Aprovação em quiz', 30, true),
  ('quiz_completar_tentativas', 'Completar todas as tentativas', 10, true)
ON CONFLICT (acao) DO NOTHING;