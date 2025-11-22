-- Remover o trigger que causa conflito (o nome correto do trigger é on_profile_delete)
DROP TRIGGER IF EXISTS on_profile_delete ON public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.delete_auth_user() CASCADE;

-- A política RLS já permite que admins deletem profiles
-- Apenas deletar de profiles é suficiente para remover o usuário da aplicação