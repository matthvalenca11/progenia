-- Suporte a cadastro de usuários fora do Brasil
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS country text;

CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);

-- Atualiza função de criação de perfil no signup para persistir país
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    institution,
    birth_date,
    gender,
    state_uf,
    city,
    country,
    education_level,
    profession
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'institution', ''),
    CASE
      WHEN NULLIF(NEW.raw_user_meta_data->>'birth_date', '') IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'gender', ''),
    NULLIF(NEW.raw_user_meta_data->>'state_uf', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'education_level', ''),
    NULLIF(NEW.raw_user_meta_data->>'profession', '')
  );

  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;
