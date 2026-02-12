-- Tabela de reclamações / bugs reportados pelos usuários
CREATE TABLE IF NOT EXISTS public.complains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved'))
);

-- FK para join com profiles (nome do usuário no admin)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.complains
    DROP CONSTRAINT IF EXISTS complains_profiles_id_fkey;
    ALTER TABLE public.complains
    ADD CONSTRAINT complains_profiles_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_complains_user_id ON public.complains(user_id);
CREATE INDEX IF NOT EXISTS idx_complains_created_at ON public.complains(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complains_status ON public.complains(status);

-- RLS
ALTER TABLE public.complains ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado pode inserir sua própria reclamação
CREATE POLICY "Users can insert own complain"
  ON public.complains FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuário pode ver apenas suas próprias reclamações (opcional; admins verão via policy separada)
CREATE POLICY "Users can view own complains"
  ON public.complains FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins podem ver todas e atualizar status
CREATE POLICY "Admins can view all complains"
  ON public.complains FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update complain status"
  ON public.complains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (true);

COMMENT ON TABLE public.complains IS 'Bugs/reclamações reportados pelos usuários; visíveis para admins em Complains.';
