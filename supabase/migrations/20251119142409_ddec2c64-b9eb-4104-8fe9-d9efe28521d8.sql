-- Add name and description columns to virtual_labs table
ALTER TABLE public.virtual_labs 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;