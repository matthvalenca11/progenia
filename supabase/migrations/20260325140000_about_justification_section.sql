-- Layout "Justificativa" (Por que o ProGenia existe?) alinhado ao ProGenia.html
COMMENT ON COLUMN public.about_page_sections.section_type IS 'Tipos: hero, text, justification, text_image, text_video, features, stats, cta, gallery, timeline, testimonials, faq, comparison, mvv';

UPDATE public.about_page_sections
SET
  section_type = 'justification',
  title = 'Por que o ProGenia existe?',
  subtitle = NULL,
  description = 'Sem base física, o risco clínico cresce; a ProGenia fecha o gap entre execução técnica e raciocínio científico.',
  content_data = $j$
{
  "kicker": "Justificativa",
  "cards": [
    {
      "label": "A dor",
      "title": "Equipamentos complexos tratados como “caixas pretas”",
      "description": "Muitos profissionais operam sem dominar o impacto clínico de cada parâmetro."
    },
    {
      "label": "A consequência",
      "title": "Erro técnico vira risco clínico",
      "description": "Resultado: artefatos, pior qualidade diagnóstica e mais risco terapêutico."
    },
    {
      "label": "A lacuna formativa",
      "title": "Graduação insuficiente e acesso desigual à atualização",
      "description": "Muitas graduações não aprofundam o ensino de novas tecnologias, e a formação continuada é escassa fora dos grandes centros."
    },
    {
      "label": "A solução ProGenia",
      "title": "Simulação visual para prática clínica segura",
      "description": "Transformamos teoria em prática segura: testar, interpretar e corrigir condutas."
    }
  ]
}
$j$::jsonb
WHERE section_type = 'text'
  AND (
    title ILIKE '%Por Que%a ProGenia%'
    OR title ILIKE '%Por Que ProGenia%'
    OR title ILIKE '%por que o progenia%'
  );
