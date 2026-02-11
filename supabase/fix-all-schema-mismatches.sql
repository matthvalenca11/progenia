-- ============================================================
-- Corrige TODOS os possíveis erros de schema
-- Execute no SQL Editor: https://supabase.com/dashboard/project/flhhvrhcrxvxnnbrggwt/sql/new
-- ============================================================

-- 1. LESSON_PROGRESS (app usa) vs USER_PROGRESS (antigo)
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status text DEFAULT 'nao_iniciado',
  progress_percentage integer DEFAULT 0,
  data_conclusao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

-- Garantir colunas existem (tabela pode ter sido criada por migration antiga)
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS progress_percentage integer DEFAULT 0;
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS data_conclusao timestamptz;
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS status text DEFAULT 'nao_iniciado';
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Migrar de user_progress se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_progress') THEN
    INSERT INTO public.lesson_progress (user_id, lesson_id, status, progress_percentage, data_conclusao, updated_at)
    SELECT user_id, lesson_id,
      (CASE WHEN completed THEN 'concluido' ELSE 'em_progresso' END)::progress_status,
      CASE WHEN completed THEN 100 ELSE COALESCE(time_spent_minutes * 2, 0) END,
      completed_at, COALESCE(last_accessed_at, now())
    FROM public.user_progress
    ON CONFLICT (user_id, lesson_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários podem ver seu progresso" ON public.lesson_progress;
CREATE POLICY "Usuários podem ver seu progresso" ON public.lesson_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem inserir progresso" ON public.lesson_progress;
CREATE POLICY "Usuários podem inserir progresso" ON public.lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem atualizar progresso" ON public.lesson_progress;
CREATE POLICY "Usuários podem atualizar progresso" ON public.lesson_progress FOR UPDATE USING (auth.uid() = user_id);

-- 2. USER_STATS - colunas usadas pelo Dashboard/Leaderboard e Profile
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_lessons_completed integer DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_time_spent integer DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_xp integer DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS modules_completed integer DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_time_minutes integer DEFAULT 0;

-- Sincronizar valores antigos -> novos (se colunas antigas existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'modules_completed') THEN
    UPDATE public.user_stats SET total_lessons_completed = COALESCE(total_lessons_completed, modules_completed, 0) WHERE total_lessons_completed IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'total_time_minutes') THEN
    UPDATE public.user_stats SET total_time_spent = COALESCE(total_time_spent, total_time_minutes, 0) WHERE total_time_spent IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'total_xp') THEN
    UPDATE public.user_stats SET total_points = COALESCE(total_points, total_xp, 0) WHERE total_points IS NULL;
  END IF;
END $$;

-- 3. MODULES - is_published (copiar de published se existir)
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'published') THEN
    UPDATE public.modules SET is_published = COALESCE(published, false) WHERE is_published IS NOT TRUE;
  END IF;
END $$;

-- 4. LESSONS - is_published (copiar de published se existir)
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'published') THEN
    UPDATE public.lessons SET is_published = COALESCE(published, false) WHERE is_published IS NOT TRUE;
  END IF;
END $$;

-- 5. QUIZ TABLES - criar se não existirem (app usa quiz_questions, quiz_options, quiz_attempts)
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  explanation text,
  points integer DEFAULT 1,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb DEFAULT '[]',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT now()
);

-- RLS para quiz tables
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quiz questions SELECT" ON public.quiz_questions;
CREATE POLICY "Quiz questions SELECT" ON public.quiz_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Quiz options SELECT" ON public.quiz_options;
CREATE POLICY "Quiz options SELECT" ON public.quiz_options FOR SELECT USING (true);
DROP POLICY IF EXISTS "Quiz attempts own" ON public.quiz_attempts;
CREATE POLICY "Quiz attempts own" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id);
