-- Criar enum para papéis de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  institution TEXT,
  professional_role TEXT,
  cargo TEXT,
  descricao TEXT,
  papel TEXT DEFAULT 'aluno',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tabela de roles de usuários (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função para verificar role (SECURITY DEFINER para evitar recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tabela de estatísticas de usuário
CREATE TABLE public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_lessons_completed INTEGER DEFAULT 0,
  total_time_spent INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Tabela de módulos
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Tabela de aulas
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_data JSONB,
  order_index INTEGER,
  duration_minutes INTEGER,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Tabela de progresso de aulas
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'nao_iniciado',
  progress_percentage INTEGER DEFAULT 0,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Tabela de matrículas em módulos
CREATE TABLE public.module_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, module_id)
);

ALTER TABLE public.module_enrollments ENABLE ROW LEVEL SECURITY;

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar trigger para user_stats
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar trigger para modules
CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar trigger para lessons
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar trigger para lesson_progress
CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Trigger para criar perfil no signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies para user_roles
CREATE POLICY "Todos podem ver roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas admins podem inserir roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem deletar roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para user_stats
CREATE POLICY "Usuários podem ver suas próprias estatísticas"
  ON public.user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias estatísticas"
  ON public.user_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies para modules
CREATE POLICY "Todos podem ver módulos publicados"
  ON public.modules FOR SELECT
  TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem criar módulos"
  ON public.modules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar módulos"
  ON public.modules FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem deletar módulos"
  ON public.modules FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para lessons
CREATE POLICY "Todos podem ver aulas publicadas"
  ON public.lessons FOR SELECT
  TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem criar aulas"
  ON public.lessons FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar aulas"
  ON public.lessons FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem deletar aulas"
  ON public.lessons FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para lesson_progress
CREATE POLICY "Usuários podem ver seu próprio progresso"
  ON public.lesson_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio progresso"
  ON public.lesson_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
  ON public.lesson_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies para module_enrollments
CREATE POLICY "Usuários podem ver suas próprias matrículas"
  ON public.module_enrollments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem se matricular em módulos"
  ON public.module_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem cancelar suas matrículas"
  ON public.module_enrollments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);