-- Broaden the MRI-only learning module to medical imaging (MRI, CT, PET, etc.)

UPDATE public.modules
SET
  title = 'Diagnóstico por Imagem',
  description = 'MRI, TC, PET e outras modalidades de imagem médica: física, sequências, contraste, interpretação e laboratórios virtuais interativos.'
WHERE
  title ILIKE '%resson%'
  OR title ILIKE '%imagens por%';

UPDATE public.badges
SET
  name = 'Especialista em Imagem',
  description = 'Domine os quizzes de diagnóstico por imagem (MRI, CT, PET)'
WHERE name = 'Especialista em RM';

INSERT INTO public.translation_glossary (source_lang, target_lang, source_text, target_text, priority)
VALUES
  ('pt', 'en', 'diagnóstico por imagem', 'medical imaging', 10),
  ('pt', 'en', 'Diagnóstico por Imagem', 'Medical Imaging', 10),
  ('pt', 'en', 'imagem médica', 'medical imaging', 10),
  ('pt', 'en', 'Imagem médica', 'Medical imaging', 10),
  ('pt', 'en', 'Imagem por RM', 'MRI imaging', 10),
  ('pt', 'en', 'laboratório de imagem', 'imaging lab', 10)
ON CONFLICT (source_lang, target_lang, source_text) DO UPDATE
SET target_text = EXCLUDED.target_text,
    priority = EXCLUDED.priority,
    is_active = true,
    updated_at = now();

-- Align lesson/capsule titles that mirrored the old module name
UPDATE public.lessons
SET title = 'Diagnóstico por Imagem'
WHERE title ILIKE '%imagens por resson%';

UPDATE public.lessons
SET description = REPLACE(description, 'Imagens por Ressonância Magnética', 'Diagnóstico por Imagem')
WHERE description ILIKE '%imagens por resson%';

UPDATE public.lessons
SET description = REPLACE(description, 'Ressonância Magnética', 'Diagnóstico por Imagem (MRI, CT, PET)')
WHERE description ILIKE '%ressonância magnética%'
  AND description NOT ILIKE '%MRI%'
  AND description NOT ILIKE '%TC%'
  AND description NOT ILIKE '%PET%';

UPDATE public.capsulas
SET title = 'Diagnóstico por Imagem'
WHERE title ILIKE '%imagens por resson%';

UPDATE public.capsulas
SET description = REPLACE(description, 'Imagens por Ressonância Magnética', 'Diagnóstico por Imagem')
WHERE description ILIKE '%imagens por resson%';

UPDATE public.capsulas
SET description = REPLACE(description, 'Ressonância Magnética', 'Diagnóstico por Imagem (MRI, CT, PET)')
WHERE description ILIKE '%ressonância magnética%'
  AND description NOT ILIKE '%MRI%'
  AND description NOT ILIKE '%TC%'
  AND description NOT ILIKE '%PET%';

-- Virtual labs: keep MRI-specific lab names but drop module-wide "Ressonância Magnética" branding
UPDATE public.virtual_labs
SET
  name = REPLACE(name, 'Ressonância Magnética', 'Imagem por RM'),
  title = REPLACE(title, 'Ressonância Magnética', 'Imagem por RM')
WHERE name ILIKE '%ressonância magnética%' OR title ILIKE '%ressonância magnética%';

UPDATE public.virtual_labs
SET description = REPLACE(description, 'módulo de ressonância magnética', 'módulo de diagnóstico por imagem')
WHERE description ILIKE '%módulo de ressonância%';
