-- Cria tabela capsula_progress (nome usado pelo app) e migra dados de capsula_progresso_usuario
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.capsula_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsula_id uuid NOT NULL REFERENCES public.capsulas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'nao_iniciado',
  progress_percentage integer DEFAULT 0,
  data_conclusao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (capsula_id, user_id)
);

-- Migrar dados de capsula_progresso_usuario para capsula_progress
INSERT INTO public.capsula_progress (capsula_id, user_id, status, progress_percentage, data_conclusao, updated_at)
SELECT 
  capsula_id,
  usuario_id AS user_id,
  CASE WHEN concluida THEN 'concluido' ELSE 'em_progresso' END AS status,
  COALESCE(acertos_quiz, 0) AS progress_percentage,
  CASE WHEN concluida THEN updated_at ELSE NULL END AS data_conclusao,
  updated_at
FROM public.capsula_progresso_usuario
ON CONFLICT (capsula_id, user_id) DO NOTHING;

-- RLS
ALTER TABLE public.capsula_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seu próprio progresso" ON public.capsula_progress;
CREATE POLICY "Usuários podem ver seu próprio progresso" ON public.capsula_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem inserir seu próprio progresso" ON public.capsula_progress;
CREATE POLICY "Usuários podem inserir seu próprio progresso" ON public.capsula_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio progresso" ON public.capsula_progress;
CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON public.capsula_progress
  FOR UPDATE USING (auth.uid() = user_id);
