-- Adicionar política RLS para permitir que admins excluam perfis de usuários
CREATE POLICY "Admins podem deletar perfis"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Adicionar trigger para deletar usuário do auth quando perfil é deletado
CREATE OR REPLACE FUNCTION public.delete_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deletar o usuário do auth.users (isso cascateará para outras tabelas)
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user();