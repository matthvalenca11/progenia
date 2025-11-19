-- Políticas RLS para storage - permitir upload de assets de cápsulas

-- Política para permitir upload no bucket lesson-assets (imagens de cápsulas)
CREATE POLICY "Usuários autenticados podem fazer upload em lesson-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lesson-assets');

-- Política para permitir leitura de assets
CREATE POLICY "Qualquer um pode ler lesson-assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'lesson-assets');

-- Política para permitir atualização de assets próprios
CREATE POLICY "Usuários autenticados podem atualizar lesson-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-assets')
WITH CHECK (bucket_id = 'lesson-assets');

-- Política para permitir deleção de assets
CREATE POLICY "Usuários autenticados podem deletar lesson-assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-assets');

-- Políticas para lesson-videos (vídeos de cápsulas)
CREATE POLICY "Usuários autenticados podem fazer upload em lesson-videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Qualquer um pode ler lesson-videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'lesson-videos');

CREATE POLICY "Usuários autenticados podem atualizar lesson-videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-videos')
WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Usuários autenticados podem deletar lesson-videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-videos');