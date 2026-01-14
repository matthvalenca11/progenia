-- Drop the old constraint
ALTER TABLE public.virtual_labs DROP CONSTRAINT IF EXISTS virtual_labs_lab_type_check;

-- Add new constraint with ultrassom_terapeutico included
ALTER TABLE public.virtual_labs ADD CONSTRAINT virtual_labs_lab_type_check 
CHECK (lab_type = ANY (ARRAY['ultrasound'::text, 'tens'::text, 'mri'::text, 'thermal'::text, 'electrotherapy'::text, 'other'::text, 'ultrassom_terapeutico'::text]));