-- Add order_index column to capsulas if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'capsulas' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE public.capsulas ADD COLUMN order_index integer DEFAULT 0;

    -- If ordem column exists, copy values to order_index
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'capsulas' AND column_name = 'ordem'
    ) THEN
      UPDATE public.capsulas SET order_index = COALESCE(ordem, 0);
    ELSE
      UPDATE public.capsulas SET order_index = 0 WHERE order_index IS NULL;
    END IF;
  END IF;
END $$;
