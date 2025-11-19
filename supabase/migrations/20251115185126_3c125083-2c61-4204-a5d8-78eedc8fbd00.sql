-- Criar buckets para armazenamento de imagens
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('partner-logos', 'partner-logos', true),
  ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para partner-logos
CREATE POLICY "Qualquer pessoa pode ver logos de parceiros"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

CREATE POLICY "Admins podem fazer upload de logos de parceiros"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'partner-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem atualizar logos de parceiros"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'partner-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar logos de parceiros"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'partner-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Políticas RLS para team-photos
CREATE POLICY "Qualquer pessoa pode ver fotos da equipe"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-photos');

CREATE POLICY "Admins podem fazer upload de fotos da equipe"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem atualizar fotos da equipe"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'team-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar fotos da equipe"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'team-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);