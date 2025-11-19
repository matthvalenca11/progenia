-- Add virtual_lab_id column to capsulas table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'capsulas' 
    AND column_name = 'virtual_lab_id'
  ) THEN
    ALTER TABLE public.capsulas 
    ADD COLUMN virtual_lab_id UUID REFERENCES public.virtual_labs(id) ON DELETE SET NULL;
  END IF;
END $$;