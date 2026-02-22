-- Tabela para controlar quais posts do Instagram aparecem no blog
CREATE TABLE IF NOT EXISTS public.instagram_posts_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_post_id text NOT NULL UNIQUE, -- ID do post no Instagram (vem da API)
  is_visible boolean NOT NULL DEFAULT true, -- true = aparece no blog, false = oculto
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_visibility_post_id ON public.instagram_posts_visibility(instagram_post_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_visibility_visible ON public.instagram_posts_visibility(is_visible);

ALTER TABLE public.instagram_posts_visibility ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar visibilidade
CREATE POLICY "Admins can manage instagram posts visibility"
  ON public.instagram_posts_visibility
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Qualquer um autenticado pode ler (para a Edge Function usar service role)
CREATE POLICY "Authenticated users can read instagram posts visibility"
  ON public.instagram_posts_visibility
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.instagram_posts_visibility IS 'Controla quais posts do Instagram aparecem na página de blog.';
