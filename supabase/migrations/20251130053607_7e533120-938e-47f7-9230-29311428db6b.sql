-- Adicionar coluna slug à tabela virtual_labs
ALTER TABLE public.virtual_labs 
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Gerar slugs para labs existentes
UPDATE public.virtual_labs
SET slug = COALESCE(
  slug,
  lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(name, '[áàãâä]', 'a', 'g'),
        '[éèêë]', 'e', 'g'
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  )
)
WHERE slug IS NULL OR slug = '';

-- Tornar slug obrigatório após preencher valores existentes
ALTER TABLE public.virtual_labs
ALTER COLUMN slug SET NOT NULL;