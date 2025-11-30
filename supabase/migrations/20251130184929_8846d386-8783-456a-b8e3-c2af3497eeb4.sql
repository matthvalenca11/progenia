-- Create tissue_configs table for anatomical configurations
CREATE TABLE IF NOT EXISTS public.tissue_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Layer thicknesses (0-1 normalized)
  skin_thickness DECIMAL(3,2) NOT NULL CHECK (skin_thickness >= 0 AND skin_thickness <= 1),
  fat_thickness DECIMAL(3,2) NOT NULL CHECK (fat_thickness >= 0 AND fat_thickness <= 1),
  muscle_thickness DECIMAL(3,2) NOT NULL CHECK (muscle_thickness >= 0 AND muscle_thickness <= 1),
  bone_depth DECIMAL(3,2) NOT NULL CHECK (bone_depth >= 0 AND bone_depth <= 1),
  
  -- Metal implant properties
  has_metal_implant BOOLEAN NOT NULL DEFAULT FALSE,
  metal_implant_depth DECIMAL(3,2) CHECK (metal_implant_depth IS NULL OR (metal_implant_depth >= 0 AND metal_implant_depth <= 1)),
  metal_implant_span DECIMAL(3,2) CHECK (metal_implant_span IS NULL OR (metal_implant_span >= 0 AND metal_implant_span <= 1)),
  
  -- Tissue type
  tissue_type TEXT NOT NULL CHECK (tissue_type IN ('soft', 'muscular', 'mixed')),
  
  -- Risk simulation
  enable_risk_simulation BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tissue_configs ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read tissue configs
CREATE POLICY "Tissue configs are viewable by everyone" 
ON public.tissue_configs 
FOR SELECT 
USING (true);

-- Only admins can insert/update/delete tissue configs
CREATE POLICY "Admins can insert tissue configs" 
ON public.tissue_configs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update tissue configs" 
ON public.tissue_configs 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete tissue configs" 
ON public.tissue_configs 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_tissue_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tissue_configs_updated_at
BEFORE UPDATE ON public.tissue_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_tissue_configs_updated_at();

-- Insert default tissue configuration
INSERT INTO public.tissue_configs (
  name, 
  description, 
  skin_thickness, 
  fat_thickness, 
  muscle_thickness, 
  bone_depth,
  has_metal_implant,
  tissue_type,
  enable_risk_simulation
) VALUES (
  'Antebraço Padrão',
  'Anatomia padrão de antebraço adulto saudável',
  0.15,
  0.25,
  0.60,
  0.85,
  false,
  'muscular',
  true
);

-- Add tissue_config_id to tens_lab_configs
ALTER TABLE public.tens_lab_configs 
ADD COLUMN IF NOT EXISTS tissue_config_id UUID REFERENCES public.tissue_configs(id) ON DELETE SET NULL;