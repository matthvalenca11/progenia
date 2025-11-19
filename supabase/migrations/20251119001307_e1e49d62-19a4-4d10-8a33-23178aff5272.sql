-- Add ultrasound_lab_config column to capsulas table
-- This stores configuration for which ultrasound controls to show per capsule

ALTER TABLE public.capsulas
ADD COLUMN IF NOT EXISTS ultrasound_lab_config JSONB DEFAULT '{"enabled": true, "showGain": true, "showDepth": true, "showFrequency": true, "showFocus": true}'::jsonb;

COMMENT ON COLUMN public.capsulas.ultrasound_lab_config IS 'Configuration for ultrasound lab controls visibility per capsule';
