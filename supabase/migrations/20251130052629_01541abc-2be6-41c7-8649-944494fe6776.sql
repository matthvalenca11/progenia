-- Tabela de configurações do laboratório TENS por cápsula
CREATE TABLE public.tens_lab_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsula_id UUID NOT NULL REFERENCES public.capsulas(id) ON DELETE CASCADE,
  lab_key TEXT NOT NULL DEFAULT 'tens',
  
  -- Controles habilitados
  enabled_controls JSONB NOT NULL DEFAULT '{"frequency": true, "pulseWidth": true, "intensity": true, "mode": true}'::jsonb,
  
  -- Modos permitidos
  allowed_modes JSONB NOT NULL DEFAULT '["convencional", "acupuntura", "burst", "modulado"]'::jsonb,
  
  -- Ranges de valores
  frequency_range JSONB NOT NULL DEFAULT '{"min": 1, "max": 200}'::jsonb,
  pulse_width_range JSONB NOT NULL DEFAULT '{"min": 50, "max": 400}'::jsonb,
  intensity_range JSONB NOT NULL DEFAULT '{"min": 0, "max": 80}'::jsonb,
  
  -- Exibições opcionais
  show_waveform BOOLEAN NOT NULL DEFAULT true,
  show_comfort_card BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir apenas uma config por cápsula
  UNIQUE(capsula_id, lab_key)
);

-- Habilitar RLS
ALTER TABLE public.tens_lab_configs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admins podem ver todas as configs TENS"
ON public.tens_lab_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins podem criar configs TENS"
ON public.tens_lab_configs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins podem atualizar configs TENS"
ON public.tens_lab_configs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins podem deletar configs TENS"
ON public.tens_lab_configs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Política para estudantes visualizarem config da cápsula que estão acessando
CREATE POLICY "Usuários podem ver configs de cápsulas publicadas"
ON public.tens_lab_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.capsulas
    WHERE capsulas.id = tens_lab_configs.capsula_id
    AND capsulas.is_published = true
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_tens_lab_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tens_lab_configs_updated_at
BEFORE UPDATE ON public.tens_lab_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_tens_lab_configs_updated_at();

-- Índices para performance
CREATE INDEX idx_tens_lab_configs_capsula_id ON public.tens_lab_configs(capsula_id);
CREATE INDEX idx_tens_lab_configs_lab_key ON public.tens_lab_configs(lab_key);