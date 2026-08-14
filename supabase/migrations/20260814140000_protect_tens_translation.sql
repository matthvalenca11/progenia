-- TENS is a medical acronym. Google Translate reads it as the Portuguese verb "tens" ("you have").
INSERT INTO public.translation_glossary (source_lang, target_lang, source_text, target_text, priority)
VALUES
  ('pt', 'en', 'TENS', 'TENS', 1),
  ('pt', 'en', 'NMES', 'NMES', 1),
  ('pt', 'en', 'FES', 'FES', 1),
  ('pt', 'en', 'EMG', 'EMG', 1),
  ('pt', 'en', 'EEG', 'EEG', 1),
  ('pt', 'en', 'ECG', 'ECG', 1),
  ('pt', 'en', 'MRI', 'MRI', 1),
  ('pt', 'en', 'LLLT', 'LLLT', 1),
  ('pt', 'en', 'FBM', 'FBM', 1),
  ('pt', 'en', 'PET', 'PET', 1),
  ('pt', 'en', 'voltar', 'Back', 5)
ON CONFLICT (source_lang, target_lang, source_text) DO UPDATE
SET target_text = EXCLUDED.target_text,
    priority = EXCLUDED.priority,
    is_active = true,
    updated_at = now();

DELETE FROM public.translation_cache
WHERE source_lang = 'pt'
  AND target_lang = 'en'
  AND (
    lower(trim(source_text)) = 'tens'
    OR (
      source_text ~* '\yTENS\y'
      AND translated_text ~* '\yyou have\y'
    )
    OR lower(trim(translated_text)) IN ('you have', 'to go back')
  );
