-- Garante ícone Globe (Lucide, contorno) no cartão "Acesso e Escalabilidade" — remove emoji 🌍 legado
UPDATE public.about_page_sections
SET content_data = jsonb_set(
  content_data,
  '{values}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN (elem->>'title') ILIKE '%Acesso e Escalabilidade%'
            THEN elem || jsonb_build_object('icon', 'Globe')
          ELSE elem
        END
      ),
      content_data->'values'
    )
    FROM jsonb_array_elements(content_data->'values') AS elem
  )
)
WHERE section_type = 'mvv'
  AND jsonb_typeof(content_data->'values') = 'array';
