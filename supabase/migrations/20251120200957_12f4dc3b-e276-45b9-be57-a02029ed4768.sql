-- ==========================================
-- SISTEMA DE QUIZZES COMPLETO
-- ==========================================

-- Tabela de quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  passing_score INTEGER DEFAULT 70,
  time_limit_minutes INTEGER,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de questões
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  points INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de opções de resposta
CREATE TABLE IF NOT EXISTS public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de tentativas de quiz
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- SISTEMA DE GAMIFICAÇÃO
-- ==========================================

-- Tabela de badges/conquistas
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('lessons_completed', 'modules_completed', 'streak_days', 'quiz_perfect', 'total_time')),
  requirement_value INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de badges conquistadas por usuários
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Adicionar coluna de pontos total na tabela user_stats
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- ==========================================
-- STORAGE BUCKETS
-- ==========================================

-- Bucket para vídeos de aulas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-videos',
  'lesson-videos',
  false,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para assets de aulas (imagens, PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-assets',
  'lesson-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para thumbnails de módulos e cápsulas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Quizzes
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver quizzes publicados"
  ON public.quizzes FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem criar quizzes"
  ON public.quizzes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem atualizar quizzes"
  ON public.quizzes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem deletar quizzes"
  ON public.quizzes FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz Questions
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver questões de quizzes publicados"
  ON public.quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes 
      WHERE quizzes.id = quiz_questions.quiz_id 
      AND (quizzes.is_published = true OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Apenas admins podem gerenciar questões"
  ON public.quiz_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Quiz Options
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver opções de quizzes publicados"
  ON public.quiz_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_questions 
      JOIN public.quizzes ON quizzes.id = quiz_questions.quiz_id
      WHERE quiz_questions.id = quiz_options.question_id 
      AND (quizzes.is_published = true OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Apenas admins podem gerenciar opções"
  ON public.quiz_options FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Quiz Attempts
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias tentativas"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias tentativas"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas tentativas"
  ON public.quiz_attempts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver badges"
  ON public.badges FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar badges"
  ON public.badges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User Badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode atribuir badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos badges de usuários"
  ON public.user_badges FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage Policies para lesson-videos
CREATE POLICY "Usuários autenticados podem ver vídeos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins podem fazer upload de vídeos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lesson-videos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar vídeos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lesson-videos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar vídeos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lesson-videos' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage Policies para lesson-assets (público)
CREATE POLICY "Todos podem ver assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-assets');

CREATE POLICY "Admins podem fazer upload de assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lesson-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lesson-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lesson-assets' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage Policies para thumbnails (público)
CREATE POLICY "Todos podem ver thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Admins podem fazer upload de thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar thumbnails"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar thumbnails"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- BADGES INICIAIS
-- ==========================================

INSERT INTO public.badges (name, description, icon_name, requirement_type, requirement_value, points) VALUES
  ('Primeiro Passo', 'Complete sua primeira aula', 'GraduationCap', 'lessons_completed', 1, 10),
  ('Estudante Dedicado', 'Complete 10 aulas', 'BookOpen', 'lessons_completed', 10, 50),
  ('Mestre do Conhecimento', 'Complete 50 aulas', 'Award', 'lessons_completed', 50, 200),
  ('Especialista', 'Complete um módulo inteiro', 'Trophy', 'modules_completed', 1, 100),
  ('Persistente', 'Mantenha uma sequência de 7 dias', 'Flame', 'streak_days', 7, 75),
  ('Incansável', 'Mantenha uma sequência de 30 dias', 'Zap', 'streak_days', 30, 300),
  ('Perfeccionista', 'Tire nota máxima em um quiz', 'Star', 'quiz_perfect', 1, 50),
  ('Maratonista', 'Estude por 10 horas no total', 'Clock', 'total_time', 600, 150)
ON CONFLICT DO NOTHING;