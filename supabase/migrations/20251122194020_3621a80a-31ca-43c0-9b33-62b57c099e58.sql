-- Criar bucket para logos de parceiros
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para fotos da equipe
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para partner-logos
CREATE POLICY "Logos de parceiros são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

CREATE POLICY "Admins podem fazer upload de logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'partner-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem atualizar logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'partner-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'partner-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Políticas de storage para team-photos
CREATE POLICY "Fotos da equipe são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-photos');

CREATE POLICY "Admins podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem atualizar fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'team-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'team-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);