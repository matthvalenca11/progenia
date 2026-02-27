-- Campos adicionais para cadastro completo de usuários
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS state_uf text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS education_level text,
ADD COLUMN IF NOT EXISTS profession text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_check
      CHECK (gender IN ('masculino', 'feminino', 'prefiro_nao_dizer'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_state_uf_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_state_uf_check
      CHECK (state_uf IS NULL OR length(state_uf) = 2);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_state_uf ON public.profiles(state_uf);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_profession ON public.profiles(profession);
CREATE INDEX IF NOT EXISTS idx_profiles_education_level ON public.profiles(education_level);

-- Atualiza função de criação de perfil no signup para persistir os novos campos
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
    NULLIF(NEW.raw_user_meta_data->>'education_level', ''),
    NULLIF(NEW.raw_user_meta_data->>'profession', '')
  );

  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;
