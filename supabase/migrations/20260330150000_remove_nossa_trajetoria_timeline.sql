-- Remove seção linha do tempo "Nossa Trajetória"
DELETE FROM public.about_page_sections
WHERE section_type = 'timeline'
  AND (
    id = 'b43eb8c0-a176-4bcf-bacd-79d569d1c5ae'
    OR trim(coalesce(title, '')) = 'Nossa Trajetória'
  );
