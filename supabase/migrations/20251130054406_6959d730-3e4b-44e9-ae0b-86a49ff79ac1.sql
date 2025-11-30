-- Remove old check constraint if it exists
ALTER TABLE public.virtual_labs 
DROP CONSTRAINT IF EXISTS virtual_labs_lab_type_check;

-- Add updated check constraint to allow 'tens' lab type
ALTER TABLE public.virtual_labs 
ADD CONSTRAINT virtual_labs_lab_type_check 
CHECK (lab_type IN ('ultrasound', 'tens', 'mri', 'thermal', 'electrotherapy', 'other'));