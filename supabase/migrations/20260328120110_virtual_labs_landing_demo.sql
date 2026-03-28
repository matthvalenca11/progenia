-- Coluna para marcar qual lab aparece no "Try demo" da landing (no máximo um true por lab_type).
ALTER TABLE public.virtual_labs
ADD COLUMN IF NOT EXISTS is_landing_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.virtual_labs.is_landing_demo IS 'Se true, candidato a demo na landing; no máximo um por lab_type.';

CREATE UNIQUE INDEX IF NOT EXISTS virtual_labs_one_landing_demo_per_lab_type
ON public.virtual_labs (lab_type)
WHERE (is_landing_demo = true);

-- PostgREST precisa recarregar o cache para enxergar a coluna nova
NOTIFY pgrst, 'reload schema';
