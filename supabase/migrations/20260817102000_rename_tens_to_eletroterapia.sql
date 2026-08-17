-- Replace user-facing "TENS" labels with "eletroterapia" / "Electrotherapy"

INSERT INTO public.translation_glossary (source_lang, target_lang, source_text, target_text, priority)
VALUES
  ('pt', 'en', 'Laboratório virtual de eletroterapia', 'Electrotherapy virtual lab', 20),
  ('pt', 'en', 'Eletroterapia', 'Electrotherapy', 20)
ON CONFLICT (source_lang, target_lang, source_text) DO UPDATE
SET target_text = EXCLUDED.target_text,
    priority = EXCLUDED.priority,
    is_active = true,
    updated_at = now();

DELETE FROM public.translation_glossary
WHERE source_lang = 'pt'
  AND target_lang = 'en'
  AND source_text IN ('TENS', 'Eletroterapia / TENS', 'Laboratório virtual TENS');

UPDATE public.virtual_labs
SET
  name = regexp_replace(name, '\mTENS\M', 'Eletroterapia', 'gi'),
  title = regexp_replace(title, '\mTENS\M', 'Eletroterapia', 'gi')
WHERE name ~* '\mTENS\M' OR title ~* '\mTENS\M';

UPDATE public.capsulas
SET
  title = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(title, '\mno TENS\M', 'na eletroterapia', 'gi'),
          '\mdo TENS\M', 'da eletroterapia', 'gi'
        ),
        '\mo TENS\M', 'a eletroterapia', 'gi'
      ),
      '\mO TENS\M', 'A eletroterapia', 'gi'
    ),
    '\mTENS\M', 'eletroterapia', 'gi'
  ),
  description = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(description, '\mno TENS\M', 'na eletroterapia', 'gi'),
          '\mdo TENS\M', 'da eletroterapia', 'gi'
        ),
        '\mo TENS\M', 'a eletroterapia', 'gi'
      ),
      '\mO TENS\M', 'A eletroterapia', 'gi'
    ),
    '\mTENS\M', 'eletroterapia', 'gi'
  )
WHERE title ~* '\mTENS\M' OR description ~* '\mTENS\M';

-- Best-effort JSON text fields inside capsule content
UPDATE public.capsulas
SET content_data = regexp_replace(
  content_data::text,
  '\mTENS\M',
  'eletroterapia',
  'gi'
)::jsonb
WHERE content_data::text ~* '\mTENS\M';

DELETE FROM public.translation_cache
WHERE source_lang = 'pt'
  AND target_lang = 'en'
  AND (
    source_text ~* '\mTENS\M'
    OR translated_text ~* '\mTENS\M'
    OR translated_text ILIKE '%you have%'
  );
