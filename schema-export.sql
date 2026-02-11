-- ============================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS - ProGenia
-- Exportado em: 2026-02-11
-- ============================================================

-- ============================================================
-- 1. TIPOS CUSTOMIZADOS (ENUMS)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. FUNÇÕES
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tens_lab_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tissue_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email
  );
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. TABELAS (ordem respeitando dependências)
-- ============================================================

-- profiles (referencia auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  full_name text NOT NULL,
  email text,
  avatar_url text,
  institution text,
  professional_role text,
  cargo text,
  descricao text,
  papel text DEFAULT 'aluno'::text,
  email_verified boolean DEFAULT false,
  verification_token text,
  verification_expires_at timestamptz,
  password_reset_token text,
  password_reset_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- user_stats
CREATE TABLE IF NOT EXISTS public.user_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  total_lessons_completed integer DEFAULT 0,
  total_time_spent integer DEFAULT 0,
  streak_days integer DEFAULT 0,
  last_activity_date date,
  total_points integer DEFAULT 0,
  level integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- modules
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  order_index integer,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid REFERENCES public.modules(id),
  title text NOT NULL,
  description text,
  content_data jsonb,
  order_index integer,
  duration_minutes integer,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- lesson_progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id),
  status text DEFAULT 'nao_iniciado'::text,
  progress_percentage integer DEFAULT 0,
  data_conclusao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

-- module_enrollments
CREATE TABLE IF NOT EXISTS public.module_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.modules(id),
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE (user_id, module_id)
);

-- capsulas
CREATE TABLE IF NOT EXISTS public.capsulas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  module_id uuid REFERENCES public.modules(id),
  content_data jsonb DEFAULT '{"blocks": []}'::jsonb,
  thumbnail_url text,
  duration_minutes integer,
  order_index integer,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- capsula_progress
CREATE TABLE IF NOT EXISTS public.capsula_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsula_id uuid NOT NULL REFERENCES public.capsulas(id),
  user_id uuid NOT NULL,
  status text DEFAULT 'nao_iniciado'::text,
  progress_percentage integer DEFAULT 0,
  data_conclusao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (capsula_id, user_id)
);

-- virtual_labs
CREATE TABLE IF NOT EXISTS public.virtual_labs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  description text,
  lab_type text NOT NULL,
  slug text NOT NULL,
  config_data jsonb DEFAULT '{}'::jsonb,
  thumbnail_url text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- capsula_virtual_labs
CREATE TABLE IF NOT EXISTS public.capsula_virtual_labs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsula_id uuid NOT NULL REFERENCES public.capsulas(id),
  lab_id uuid NOT NULL REFERENCES public.virtual_labs(id),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (capsula_id, lab_id)
);

-- quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid REFERENCES public.lessons(id),
  title text NOT NULL,
  description text,
  passing_score integer DEFAULT 70,
  time_limit_minutes integer,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- quiz_questions
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
  question_text text NOT NULL,
  question_type text NOT NULL,
  explanation text,
  points integer DEFAULT 1,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- quiz_options
CREATE TABLE IF NOT EXISTS public.quiz_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id),
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- quiz_attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT now()
);

-- badges
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_name text NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id),
  earned_at timestamptz DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

-- partners
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text NOT NULL,
  description text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- team_members
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  photo_url text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- about_page_content
CREATE TABLE IF NOT EXISTS public.about_page_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hero_title text DEFAULT 'Sobre a ProGenia'::text,
  hero_subtitle text DEFAULT 'Democratizando o acesso ao conhecimento científico em saúde através de aprendizado interativo, simulações práticas e tecnologia de ponta.'::text,
  motivation_title text DEFAULT 'Por Que ProGenia Existe?'::text,
  motivation_description text DEFAULT 'Profissionais de saúde frequentemente utilizam tecnologias terapêuticas e diagnósticas sem compreender profundamente os princípios físicos e fisiológicos por trás delas.'::text,
  motivation_challenges jsonb DEFAULT '["Lacunas na formação sobre física aplicada à saúde", "Riscos do uso inadequado de eletroterapias e equipamentos", "Recursos de treinamento limitados e fragmentados", "Dificuldade em visualizar conceitos abstratos"]'::jsonb,
  solution_title text DEFAULT 'Nossa Solução'::text,
  solution_subtitle text DEFAULT 'ProGenia oferece uma abordagem moderna e eficaz para o aprendizado científico em saúde'::text,
  solution_features jsonb DEFAULT '[{"title": "Micro-Learning Estruturado", "description": "Conteúdo dividido em módulos curtos e focados, facilitando a absorção do conhecimento"}, {"title": "Simulações Interativas", "description": "Laboratórios virtuais onde você pode experimentar e visualizar conceitos complexos"}, {"title": "Aprendizado Personalizado", "description": "IA que acompanha seu progresso e sugere conteúdos baseados nas suas necessidades"}]'::jsonb,
  audience_title text DEFAULT 'Quem se Beneficia?'::text,
  audience_subtitle text DEFAULT 'ProGenia foi desenvolvido para profissionais e estudantes da área da saúde'::text,
  audience_stats jsonb DEFAULT '[{"icon": "👨‍⚕️", "count": "300.000+", "title": "Profissionais da Saúde no Brasil", "subtitle": "Registrados no COFFITO"}, {"icon": "🎓", "count": "600+", "title": "Cursos de Graduação", "subtitle": "Fisioterapia, Fonoaudiologia e TO"}, {"icon": "🏥", "count": "20.000+", "title": "Clínicas e centros de reabilitação física", "subtitle": "Profissionais ativos"}]'::jsonb,
  partners_title text DEFAULT 'Nossos Parceiros'::text,
  partners_subtitle text DEFAULT 'Parceiros e apoiadores da nossa missão'::text,
  team_title text DEFAULT 'Nossa Equipe'::text,
  team_subtitle text DEFAULT 'Especialistas dedicados a revolucionar a educação em saúde'::text,
  cta_title text DEFAULT 'Pronto para Transformar Seu Aprendizado?'::text,
  cta_subtitle text DEFAULT 'Faça parte da nova geração de profissionais que dominam a ciência por trás da tecnologia médica'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- about_page_sections
CREATE TABLE IF NOT EXISTS public.about_page_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_type text NOT NULL,
  title text,
  subtitle text,
  description text,
  media_url text,
  media_type text,
  layout text DEFAULT 'default'::text,
  theme text DEFAULT 'default'::text,
  content_data jsonb DEFAULT '{}'::jsonb,
  background_gradient jsonb DEFAULT '{"to": "#f9fafb", "from": "#ffffff", "direction": "to-br"}'::jsonb,
  animation_type text DEFAULT 'fade-in'::text,
  animation_delay integer DEFAULT 0,
  buttons jsonb DEFAULT '[]'::jsonb,
  spacing_top text DEFAULT 'default'::text,
  spacing_bottom text DEFAULT 'default'::text,
  custom_css text,
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- email_settings
CREATE TABLE IF NOT EXISTS public.email_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  default_from_email text,
  verification_from_email text,
  reset_from_email text,
  verification_subject text DEFAULT 'Confirme seu e-mail – ProGenia'::text,
  reset_subject text DEFAULT 'Redefinição de senha – ProGenia'::text,
  verification_body_intro text DEFAULT 'Olá! Bem-vindo(a) à plataforma ProGenia. Clique no botão abaixo para confirmar seu e-mail.'::text,
  reset_body_intro text DEFAULT 'Você solicitou a redefinição de senha na plataforma. Se não foi você, ignore este e-mail.'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- tissue_configs
CREATE TABLE IF NOT EXISTS public.tissue_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  tissue_type text NOT NULL,
  skin_thickness numeric NOT NULL,
  fat_thickness numeric NOT NULL,
  muscle_thickness numeric NOT NULL,
  bone_depth numeric NOT NULL,
  has_metal_implant boolean NOT NULL DEFAULT false,
  metal_implant_depth numeric,
  metal_implant_span numeric,
  enable_risk_simulation boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- tens_lab_configs
CREATE TABLE IF NOT EXISTS public.tens_lab_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsula_id uuid NOT NULL REFERENCES public.capsulas(id),
  tissue_config_id uuid REFERENCES public.tissue_configs(id),
  lab_key text NOT NULL DEFAULT 'tens'::text,
  enabled_controls jsonb NOT NULL DEFAULT '{"mode": true, "frequency": true, "intensity": true, "pulseWidth": true}'::jsonb,
  allowed_modes jsonb NOT NULL DEFAULT '["convencional", "acupuntura", "burst", "modulado"]'::jsonb,
  frequency_range jsonb NOT NULL DEFAULT '{"max": 200, "min": 1}'::jsonb,
  pulse_width_range jsonb NOT NULL DEFAULT '{"max": 400, "min": 50}'::jsonb,
  intensity_range jsonb NOT NULL DEFAULT '{"max": 80, "min": 0}'::jsonb,
  show_waveform boolean NOT NULL DEFAULT true,
  show_comfort_card boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capsula_id, lab_key)
);

-- ============================================================
-- 4. ÍNDICES (não-PK, não-UNIQUE constraint)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_capsula_virtual_labs_capsula_id ON public.capsula_virtual_labs USING btree (capsula_id);
CREATE INDEX IF NOT EXISTS idx_capsula_virtual_labs_lab_id ON public.capsula_virtual_labs USING btree (lab_id);
CREATE INDEX IF NOT EXISTS idx_capsula_virtual_labs_position ON public.capsula_virtual_labs USING btree (capsula_id, position);
CREATE INDEX IF NOT EXISTS idx_tens_lab_configs_capsula_id ON public.tens_lab_configs USING btree (capsula_id);
CREATE INDEX IF NOT EXISTS idx_tens_lab_configs_lab_key ON public.tens_lab_configs USING btree (lab_key);

-- ============================================================
-- 5. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsula_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsula_virtual_labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tissue_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tens_lab_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. POLÍTICAS RLS
-- ============================================================

-- ---- profiles ----
CREATE POLICY "Usuários podem ver todos os perfis" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários podem criar seu próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins podem deletar perfis" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- user_roles ----
CREATE POLICY "Todos podem ver roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem inserir roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem deletar roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- user_stats ----
CREATE POLICY "Usuários podem ver suas próprias estatísticas" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar suas próprias estatísticas" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);

-- ---- modules ----
CREATE POLICY "Todos podem ver módulos publicados" ON public.modules FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem criar módulos" ON public.modules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar módulos" ON public.modules FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem deletar módulos" ON public.modules FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- lessons ----
CREATE POLICY "Todos podem ver aulas publicadas" ON public.lessons FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem criar aulas" ON public.lessons FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar aulas" ON public.lessons FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem deletar aulas" ON public.lessons FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- lesson_progress ----
CREATE POLICY "Usuários podem ver seu próprio progresso" ON public.lesson_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem inserir seu próprio progresso" ON public.lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON public.lesson_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar seu próprio progresso de aulas" ON public.lesson_progress FOR DELETE USING (auth.uid() = user_id);

-- ---- module_enrollments ----
CREATE POLICY "Usuários podem ver suas próprias matrículas" ON public.module_enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem se matricular em módulos" ON public.module_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem cancelar suas matrículas" ON public.module_enrollments FOR DELETE USING (auth.uid() = user_id);

-- ---- capsulas ----
CREATE POLICY "Todos podem ver cápsulas publicadas" ON public.capsulas FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem criar cápsulas" ON public.capsulas FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar cápsulas" ON public.capsulas FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem deletar cápsulas" ON public.capsulas FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- capsula_progress ----
CREATE POLICY "Usuários podem ver seu próprio progresso" ON public.capsula_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem inserir seu próprio progresso" ON public.capsula_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON public.capsula_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar seu próprio progresso de cápsulas" ON public.capsula_progress FOR DELETE USING (auth.uid() = user_id);

-- ---- virtual_labs ----
CREATE POLICY "Todos podem ver labs publicados" ON public.virtual_labs FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem criar labs" ON public.virtual_labs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar labs" ON public.virtual_labs FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem deletar labs" ON public.virtual_labs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- capsula_virtual_labs ----
CREATE POLICY "Admins podem gerenciar vínculos de labs" ON public.capsula_virtual_labs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuários podem ver labs de cápsulas publicadas" ON public.capsula_virtual_labs FOR SELECT USING (EXISTS (SELECT 1 FROM capsulas WHERE capsulas.id = capsula_virtual_labs.capsula_id AND capsulas.is_published = true));

-- ---- quizzes ----
CREATE POLICY "Todos podem ver quizzes publicados" ON public.quizzes FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem criar quizzes" ON public.quizzes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar quizzes" ON public.quizzes FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem deletar quizzes" ON public.quizzes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- quiz_questions ----
CREATE POLICY "Apenas admins podem gerenciar questões" ON public.quiz_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuários podem ver questões de quizzes publicados" ON public.quiz_questions FOR SELECT USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND (quizzes.is_published = true OR has_role(auth.uid(), 'admin'::app_role))));

-- ---- quiz_options ----
CREATE POLICY "Apenas admins podem gerenciar opções" ON public.quiz_options FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuários podem ver opções de quizzes publicados" ON public.quiz_options FOR SELECT USING (EXISTS (SELECT 1 FROM quiz_questions JOIN quizzes ON quizzes.id = quiz_questions.quiz_id WHERE quiz_questions.id = quiz_options.question_id AND (quizzes.is_published = true OR has_role(auth.uid(), 'admin'::app_role))));

-- ---- quiz_attempts ----
CREATE POLICY "Usuários podem ver suas próprias tentativas" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins podem ver todas tentativas" ON public.quiz_attempts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuários podem criar suas próprias tentativas" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- badges ----
CREATE POLICY "Todos podem ver badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem gerenciar badges" ON public.badges FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- user_badges ----
CREATE POLICY "Usuários podem ver seus próprios badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins podem ver todos badges de usuários" ON public.user_badges FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Sistema pode atribuir badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- partners ----
CREATE POLICY "Todos podem ver parceiros" ON public.partners FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem gerenciar parceiros" ON public.partners FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- team_members ----
CREATE POLICY "Todos podem ver membros da equipe" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem gerenciar membros da equipe" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- about_page_content ----
CREATE POLICY "Todos podem ver conteúdo da página Sobre" ON public.about_page_content FOR SELECT USING (true);
CREATE POLICY "Apenas admins podem inserir conteúdo da página Sobre" ON public.about_page_content FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem atualizar conteúdo da página Sobre" ON public.about_page_content FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- about_page_sections ----
CREATE POLICY "Todos podem ver seções publicadas" ON public.about_page_sections FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Apenas admins podem gerenciar seções" ON public.about_page_sections FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- email_settings ----
CREATE POLICY "Apenas admins podem gerenciar configurações de e-mail" ON public.email_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- tissue_configs ----
CREATE POLICY "Tissue configs are viewable by everyone" ON public.tissue_configs FOR SELECT USING (true);
CREATE POLICY "Admins can insert tissue configs" ON public.tissue_configs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Admins can update tissue configs" ON public.tissue_configs FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Admins can delete tissue configs" ON public.tissue_configs FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

-- ---- tens_lab_configs ----
CREATE POLICY "Admins podem ver todas as configs TENS" ON public.tens_lab_configs FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Usuários podem ver configs de cápsulas publicadas" ON public.tens_lab_configs FOR SELECT USING (EXISTS (SELECT 1 FROM capsulas WHERE capsulas.id = tens_lab_configs.capsula_id AND capsulas.is_published = true));
CREATE POLICY "Admins podem criar configs TENS" ON public.tens_lab_configs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Admins podem atualizar configs TENS" ON public.tens_lab_configs FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Admins podem deletar configs TENS" ON public.tens_lab_configs FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

CREATE OR REPLACE TRIGGER update_about_page_content_updated_at BEFORE UPDATE ON public.about_page_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_about_page_sections_updated_at BEFORE UPDATE ON public.about_page_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_capsula_progress_updated_at BEFORE UPDATE ON public.capsula_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_capsula_virtual_labs_updated_at BEFORE UPDATE ON public.capsula_virtual_labs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_capsulas_updated_at BEFORE UPDATE ON public.capsulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_email_settings_updated_at BEFORE UPDATE ON public.email_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tens_lab_configs_updated_at BEFORE UPDATE ON public.tens_lab_configs FOR EACH ROW EXECUTE FUNCTION public.update_tens_lab_configs_updated_at();
CREATE OR REPLACE TRIGGER update_tissue_configs_updated_at BEFORE UPDATE ON public.tissue_configs FOR EACH ROW EXECUTE FUNCTION public.update_tissue_configs_updated_at();
CREATE OR REPLACE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_virtual_labs_updated_at BEFORE UPDATE ON public.virtual_labs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. TRIGGER PARA NOVOS USUÁRIOS (auth.users)
-- Nota: Este trigger deve ser criado manualmente no novo projeto
-- pois depende do schema auth gerenciado pelo Supabase.
-- ============================================================

-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 9. STORAGE BUCKETS (executar separadamente)
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-assets', 'lesson-assets', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-videos', 'lesson-videos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('partner-logos', 'partner-logos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('team-photos', 'team-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lab-videos', 'lab-videos', true);

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
