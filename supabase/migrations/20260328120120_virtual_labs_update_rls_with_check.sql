-- UPDATE em RLS: WITH CHECK evita updates bloqueados após alterar linhas (ex.: is_landing_demo).
DROP POLICY IF EXISTS "Apenas admins podem atualizar labs" ON public.virtual_labs;

CREATE POLICY "Apenas admins podem atualizar labs"
  ON public.virtual_labs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
