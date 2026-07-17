-- Gráficos paramétricos reutilizáveis (mesmo padrão de virtual_labs)
CREATE TABLE IF NOT EXISTS public.parametric_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.parametric_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver gráficos publicados"
  ON public.parametric_charts
  FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem criar gráficos"
  ON public.parametric_charts
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem atualizar gráficos"
  ON public.parametric_charts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem deletar gráficos"
  ON public.parametric_charts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_parametric_charts_updated_at
  BEFORE UPDATE ON public.parametric_charts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
