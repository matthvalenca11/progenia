-- Drop existing check constraint
ALTER TABLE capsulas DROP CONSTRAINT IF EXISTS capsulas_tipo_lab_check;

-- Add updated check constraint with ultrassom_avancado
ALTER TABLE capsulas ADD CONSTRAINT capsulas_tipo_lab_check 
CHECK (tipo_lab IN ('mri_viewer', 'ultrasound_simulator', 'ultrassom_avancado', 'eletroterapia_lab', 'thermal_lab'));