-- Criar novos buckets de storage
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('lesson-videos', 'lesson-videos', false),
  ('lesson-assets', 'lesson-assets', false),
  ('lab-assets', 'lab-assets', false),
  ('public-marketing', 'public-marketing', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para lesson-videos (apenas admins/instrutores podem fazer upload)
CREATE POLICY "Admins podem fazer upload de vídeos de aulas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-videos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND papel = 'instrutor'))
);

CREATE POLICY "Usuários autenticados podem ver vídeos de aulas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-videos');

CREATE POLICY "Admins podem atualizar vídeos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-videos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar vídeos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-videos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Políticas para lesson-assets
CREATE POLICY "Admins podem fazer upload de materiais"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-assets' AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND papel = 'instrutor'))
);

CREATE POLICY "Usuários autenticados podem ver materiais"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-assets');

CREATE POLICY "Admins podem atualizar materiais"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar materiais"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Políticas para lab-assets
CREATE POLICY "Admins podem fazer upload de assets de labs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lab-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Usuários autenticados podem ver assets de labs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lab-assets');

CREATE POLICY "Admins podem atualizar assets de labs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lab-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar assets de labs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lab-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Políticas para public-marketing (público pode ler, admins podem gerenciar)
CREATE POLICY "Qualquer pessoa pode ver conteúdo de marketing"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-marketing');

CREATE POLICY "Admins podem fazer upload de conteúdo de marketing"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public-marketing' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem atualizar conteúdo de marketing"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public-marketing' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar conteúdo de marketing"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'public-marketing' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Adicionar campos que faltam em lessons para vídeos externos e assets
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS video_external_url TEXT,
ADD COLUMN IF NOT EXISTS video_storage_path TEXT,
ADD COLUMN IF NOT EXISTS assets JSONB DEFAULT '[]'::jsonb;

-- Criar índice para melhorar performance em buscas
CREATE INDEX IF NOT EXISTS idx_lessons_module_published ON lessons(module_id, published);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id, status);