-- Tornar content_type opcional ou removê-lo se não for mais usado
-- Primeiro, verificar se a coluna existe e se tem constraint NOT NULL
DO $$
BEGIN
  -- Se content_type existe e tem NOT NULL, torná-la opcional
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lessons' 
    AND column_name = 'content_type'
  ) THEN
    -- Remover NOT NULL constraint se existir
    ALTER TABLE public.lessons ALTER COLUMN content_type DROP NOT NULL;
    
    -- Opcionalmente, definir um valor padrão para registros existentes
    UPDATE public.lessons SET content_type = 'interactive' WHERE content_type IS NULL;
  END IF;
END $$;
