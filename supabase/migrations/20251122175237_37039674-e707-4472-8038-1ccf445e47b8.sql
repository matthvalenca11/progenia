-- Permitir que usuários autenticados criem seu próprio perfil
CREATE POLICY "Usuários podem criar seu próprio perfil"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);