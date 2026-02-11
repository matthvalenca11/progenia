-- Garantir que o bucket lesson-assets seja público e tenha políticas corretas
-- Execute no Supabase SQL Editor

-- 1. Tornar o bucket público (se não estiver)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'lesson-assets';

-- 2. Remover políticas conflitantes antigas (se existirem)
DROP POLICY IF EXISTS "Usuários autenticados podem ver materiais" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode ler lesson-assets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem ver assets de labs" ON storage.objects;

-- 3. Criar política única e clara: TODOS podem ler lesson-assets (bucket público)
DROP POLICY IF EXISTS "Todos podem ler lesson-assets (público)" ON storage.objects;
CREATE POLICY "Todos podem ler lesson-assets (público)"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-assets');

-- 4. Garantir que admins podem fazer upload
DROP POLICY IF EXISTS "Admins podem fazer upload de assets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload em lesson-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem fazer upload em lesson-assets" ON storage.objects;

CREATE POLICY "Admins podem fazer upload em lesson-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lesson-assets' AND 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. Garantir que admins podem atualizar
DROP POLICY IF EXISTS "Admins podem atualizar assets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar lesson-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem atualizar lesson-assets" ON storage.objects;

CREATE POLICY "Admins podem atualizar lesson-assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'lesson-assets' AND 
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id = 'lesson-assets' AND 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- 6. Garantir que admins podem deletar
DROP POLICY IF EXISTS "Admins podem deletar assets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar lesson-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem deletar lesson-assets" ON storage.objects;

CREATE POLICY "Admins podem deletar lesson-assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lesson-assets' AND 
    has_role(auth.uid(), 'admin'::app_role)
  );
