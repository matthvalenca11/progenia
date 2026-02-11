-- Lookup user by email from auth.users (source of truth)
-- Fixes recovery flow when profiles.email is null (e.g. users created before email was added to handle_new_user)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;
