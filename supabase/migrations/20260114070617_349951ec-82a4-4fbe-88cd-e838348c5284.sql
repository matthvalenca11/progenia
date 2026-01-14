-- Expand lab_type check constraint to include ultrasound_therapy (used by the app) and keep ultrassom_terapeutico for backwards compatibility
ALTER TABLE public.virtual_labs DROP CONSTRAINT IF EXISTS virtual_labs_lab_type_check;
ALTER TABLE public.virtual_labs ADD CONSTRAINT virtual_labs_lab_type_check
CHECK (
  lab_type = ANY (
    ARRAY[
      'ultrasound'::text,
      'tens'::text,
      'mri'::text,
      'thermal'::text,
      'electrotherapy'::text,
      'other'::text,
      'ultrasound_therapy'::text,
      'ultrassom_terapeutico'::text
    ]
  )
);

-- SECURITY LINTER: set immutable search_path on function flagged by linter
CREATE OR REPLACE FUNCTION public.update_tens_lab_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;