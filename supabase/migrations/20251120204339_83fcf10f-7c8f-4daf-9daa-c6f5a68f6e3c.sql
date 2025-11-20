-- Tornar o bucket lesson-videos público para permitir reprodução de vídeos
UPDATE storage.buckets 
SET public = true 
WHERE id = 'lesson-videos';

-- Atualizar política para permitir que todos vejam vídeos (conteúdo educacional público)
DROP POLICY IF EXISTS "Usuários autenticados podem ver vídeos" ON storage.objects;

CREATE POLICY "Todos podem ver vídeos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lesson-videos');