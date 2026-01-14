-- Allow 'ultrasound_therapy' in virtual_labs.lab_type
-- Fixes: new row for relation "virtual_labs" violates check constraint "virtual_labs_lab_type_check"

ALTER TABLE public.virtual_labs
DROP CONSTRAINT IF EXISTS virtual_labs_lab_type_check;

ALTER TABLE public.virtual_labs
ADD CONSTRAINT virtual_labs_lab_type_check
CHECK (lab_type IN ('ultrasound', 'tens', 'ultrasound_therapy', 'mri', 'thermal', 'electrotherapy', 'other'));

