-- =============================================================================
-- Preferência: na raiz do repo, `supabase db push` (migrations
-- 20260328120110_virtual_labs_landing_demo.sql e
-- 20260328120120_virtual_labs_update_rls_with_check.sql).
--
-- Alternativa: rode este script INTEIRO no Supabase Dashboard → SQL Editor do projeto
-- cujo URL está em VITE_SUPABASE_URL (ex.: ...supabase.co).
--
-- Depois: aguarde ~10s e recarregue o admin. Se ainda falhar, confira em
-- Table Editor → virtual_labs se a coluna is_landing_demo aparece.
-- =============================================================================

-- Coluna + índice (um demo ativo por lab_type)
ALTER TABLE public.virtual_labs
ADD COLUMN IF NOT EXISTS is_landing_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.virtual_labs.is_landing_demo IS 'Se true, candidato a demo na landing; no máximo um por lab_type.';

CREATE UNIQUE INDEX IF NOT EXISTS virtual_labs_one_landing_demo_per_lab_type
ON public.virtual_labs (lab_type)
WHERE (is_landing_demo = true);

-- RLS: UPDATE com WITH CHECK
DROP POLICY IF EXISTS "Apenas admins podem atualizar labs" ON public.virtual_labs;

CREATE POLICY "Apenas admins podem atualizar labs"
  ON public.virtual_labs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Obrigatório no Supabase: PostgREST só passa a enxergar colunas novas após reload do cache
NOTIFY pgrst, 'reload schema';
