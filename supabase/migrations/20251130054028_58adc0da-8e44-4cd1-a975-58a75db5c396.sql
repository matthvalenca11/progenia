-- Criar tabela para vincular labs virtuais às cápsulas
CREATE TABLE IF NOT EXISTS public.capsula_virtual_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capsula_id uuid NOT NULL REFERENCES public.capsulas(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.virtual_labs(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(capsula_id, lab_id)
);

-- Habilitar RLS
ALTER TABLE public.capsula_virtual_labs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins podem gerenciar vínculos de labs"
ON public.capsula_virtual_labs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver labs de cápsulas publicadas"
ON public.capsula_virtual_labs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.capsulas
    WHERE capsulas.id = capsula_virtual_labs.capsula_id
    AND capsulas.is_published = true
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_capsula_virtual_labs_updated_at
BEFORE UPDATE ON public.capsula_virtual_labs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_capsula_virtual_labs_capsula_id ON public.capsula_virtual_labs(capsula_id);
CREATE INDEX IF NOT EXISTS idx_capsula_virtual_labs_lab_id ON public.capsula_virtual_labs(lab_id);
CREATE INDEX IF NOT EXISTS idx_capsula_virtual_labs_position ON public.capsula_virtual_labs(capsula_id, position);