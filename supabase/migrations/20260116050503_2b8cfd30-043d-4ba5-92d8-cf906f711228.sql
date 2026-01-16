
-- Adicionar política de DELETE para lesson_progress
CREATE POLICY "Usuários podem deletar seu próprio progresso de aulas" 
ON public.lesson_progress 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Adicionar política de DELETE para capsula_progress
CREATE POLICY "Usuários podem deletar seu próprio progresso de cápsulas" 
ON public.capsula_progress 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);
