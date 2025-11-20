-- Add email verification and password reset fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_token text,
ADD COLUMN IF NOT EXISTS verification_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS password_reset_token text,
ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamp with time zone;

-- Create email settings table for admin configuration
CREATE TABLE IF NOT EXISTS public.email_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  default_from_email text,
  verification_from_email text,
  reset_from_email text,
  verification_subject text DEFAULT 'Confirme seu e-mail – ProGenia',
  reset_subject text DEFAULT 'Redefinição de senha – ProGenia',
  verification_body_intro text DEFAULT 'Olá! Bem-vindo(a) à plataforma ProGenia. Clique no botão abaixo para confirmar seu e-mail.',
  reset_body_intro text DEFAULT 'Você solicitou a redefinição de senha na plataforma. Se não foi você, ignore este e-mail.',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default settings
INSERT INTO public.email_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Enable RLS on email_settings
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage email settings
CREATE POLICY "Apenas admins podem gerenciar configurações de e-mail"
ON public.email_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for email_settings updated_at
CREATE TRIGGER update_email_settings_updated_at
BEFORE UPDATE ON public.email_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();