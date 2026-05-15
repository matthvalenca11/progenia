-- Persist signup legal acceptance metadata from auth.raw_user_meta_data.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  terms_version_val text;
  privacy_version_val text;
  cookies_version_val text;
  terms_accepted_val boolean;
  privacy_accepted_val boolean;
  cookies_accepted_val boolean;
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

  terms_version_val := COALESCE(NULLIF(NEW.raw_user_meta_data->>'terms_version', ''), 'v1');
  privacy_version_val := COALESCE(NULLIF(NEW.raw_user_meta_data->>'privacy_version', ''), 'v1');
  cookies_version_val := COALESCE(NULLIF(NEW.raw_user_meta_data->>'cookies_version', ''), 'v1');

  terms_accepted_val := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);
  privacy_accepted_val := COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::boolean, false);
  cookies_accepted_val := COALESCE((NEW.raw_user_meta_data->>'cookies_accepted')::boolean, false);

  IF terms_accepted_val THEN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version, source, metadata)
    VALUES (
      NEW.id,
      'terms_of_use',
      terms_version_val,
      'signup',
      jsonb_build_object('origin', 'auth_signup_trigger')
    );
  END IF;

  IF privacy_accepted_val THEN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version, source, metadata)
    VALUES (
      NEW.id,
      'privacy_policy',
      privacy_version_val,
      'signup',
      jsonb_build_object('origin', 'auth_signup_trigger')
    );
  END IF;

  IF cookies_accepted_val THEN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version, source, metadata)
    VALUES (
      NEW.id,
      'cookie_policy',
      cookies_version_val,
      'signup',
      jsonb_build_object('origin', 'auth_signup_trigger')
    );
  END IF;

  RETURN NEW;
END;
$$;
