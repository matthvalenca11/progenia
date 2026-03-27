-- Allow 'photobiomodulation' in virtual_labs.lab_type
-- Fixes: new row for relation "virtual_labs" violates check constraint "virtual_labs_lab_type_check"

ALTER TABLE public.virtual_labs
DROP CONSTRAINT IF EXISTS virtual_labs_lab_type_check;

ALTER TABLE public.virtual_labs
ADD CONSTRAINT virtual_labs_lab_type_check
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
      'ultrassom_terapeutico'::text,
      'photobiomodulation'::text
    ]
  )
);

