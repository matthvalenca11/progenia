-- Remove o primeiro CTA duplicado "Pronto para Transformar Seu Aprendizado?" (mantém o de menor order_index entre os repetidos = apaga o que sobe na página)
-- Só executa deleção se existir mais de uma linha com o mesmo título/subtítulo.
DELETE FROM public.about_page_sections
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY trim(coalesce(title, '')), trim(coalesce(subtitle, ''))
        ORDER BY order_index ASC, created_at ASC
      ) AS rn,
      COUNT(*) OVER (
        PARTITION BY trim(coalesce(title, '')), trim(coalesce(subtitle, ''))
      ) AS cnt
    FROM public.about_page_sections
    WHERE section_type = 'cta'
      AND trim(coalesce(title, '')) = 'Pronto para Transformar Seu Aprendizado?'
      AND coalesce(subtitle, '') ILIKE '%ciência por trás da tecnologia médica%'
  ) sub
  WHERE cnt > 1 AND rn = 1
);
