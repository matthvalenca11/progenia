-- Categorização e demo na landing (paridade com virtual_labs)

ALTER TABLE public.parametric_charts
ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.parametric_charts
ADD COLUMN IF NOT EXISTS is_landing_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.parametric_charts.category IS
  'Disciplina/categoria editorial (ex.: electrotherapy, photobiomodulation, ultrasound).';

COMMENT ON COLUMN public.parametric_charts.is_landing_demo IS
  'Se true, candidato a demo na landing; no máximo um por category.';

CREATE UNIQUE INDEX IF NOT EXISTS parametric_charts_one_landing_demo_per_category
ON public.parametric_charts (category)
WHERE (is_landing_demo = true AND category IS NOT NULL);

NOTIFY pgrst, 'reload schema';
