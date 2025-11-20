-- Criar tabela de laboratórios virtuais
CREATE TABLE IF NOT EXISTS public.virtual_labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  lab_type TEXT NOT NULL CHECK (lab_type IN ('ultrasound', 'mri', 'thermal', 'electrotherapy', 'other')),
  config_data JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.virtual_labs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Todos podem ver labs publicados"
  ON public.virtual_labs
  FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem criar labs"
  ON public.virtual_labs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem atualizar labs"
  ON public.virtual_labs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admins podem deletar labs"
  ON public.virtual_labs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_virtual_labs_updated_at
  BEFORE UPDATE ON public.virtual_labs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();