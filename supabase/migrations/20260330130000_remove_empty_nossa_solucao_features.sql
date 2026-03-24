-- Remove bloco legado só com título/subtítulo "Nossa Solução" (sem cartões em content_data)
DELETE FROM public.about_page_sections
WHERE section_type = 'features'
  AND trim(coalesce(title, '')) = 'Nossa Solução'
  AND coalesce(subtitle, '') ILIKE '%abordagem moderna e eficaz para o aprendizado científico em saúde%'
  AND (
    content_data IS NULL
    OR jsonb_typeof(content_data) <> 'array'
    OR jsonb_array_length(content_data) = 0
  );
