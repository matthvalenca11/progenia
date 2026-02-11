-- Corrige visibilidade das cápsulas no "Em Alta Hoje"
-- Execute no SQL Editor do Supabase

-- 1. Publicar todas as cápsulas que têm título
UPDATE public.capsulas SET is_published = true 
WHERE (is_published IS NULL OR is_published = false) 
  AND (title IS NOT NULL);

-- 2. Remover política antiga (usa ativo/modulo_id que podem não existir)
DROP POLICY IF EXISTS "Usuários podem ver cápsulas ativas de módulos publicados" ON public.capsulas;

-- 3. Política para ver cápsulas publicadas
DROP POLICY IF EXISTS "Todos podem ver cápsulas publicadas" ON public.capsulas;
CREATE POLICY "Todos podem ver cápsulas publicadas" ON public.capsulas
  FOR SELECT USING (
    COALESCE(is_published, false) = true OR 
    has_role(auth.uid(), 'admin'::app_role)
  );
