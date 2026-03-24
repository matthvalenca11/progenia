-- Seção Missão, Visão e Valores na página Sobre (editável no admin)
COMMENT ON COLUMN public.about_page_sections.section_type IS 'Tipos: hero, text, text_image, text_video, features, stats, cta, gallery, timeline, testimonials, faq, comparison, mvv';

INSERT INTO public.about_page_sections (
  section_type,
  order_index,
  is_published,
  title,
  subtitle,
  description,
  media_url,
  media_type,
  content_data,
  layout,
  theme,
  background_gradient,
  animation_type,
  animation_delay,
  spacing_top,
  spacing_bottom,
  custom_css,
  buttons
)
SELECT
  'mvv',
  (SELECT COALESCE(MAX(ap.order_index), -1) + 1 FROM public.about_page_sections ap),
  true,
  'Missão, Visão e Valores',
  'O que nos move e como conduzimos nosso trabalho',
  NULL,
  NULL,
  NULL,
  $mvv$
{
  "mission_title": "Missão",
  "mission_body": "Aprimorar a educação em saúde através do rigor científico e de simulações realistas, reduzindo o erro técnico e apoiando a tomada de decisão clínica com segurança. Nosso propósito é desmistificar equipamentos complexos, convertendo a base teórica em prática clínica segura e mensurável, em constante atualização com as novas tecnologias.",
  "vision_title": "Visão",
  "vision_body": "Ser um elo entre o conhecimento teórico e a prática segura em saúde, tornando-se uma referência institucional na formação por competências e na atualização clínica contínua. Buscamos ampliar o acesso à educação de alta tecnologia, rompendo barreiras geográficas para formar profissionais que compreendem, interpretam e decidem com base na ciência.",
  "values_title": "Valores",
  "values": [
    {
      "title": "Segurança Clínica em Primeiro Lugar",
      "description": "Acreditamos que o erro técnico gera risco clínico. Por isso, oferecemos um ambiente de experimentação seguro onde o erro atua como ferramenta de ensino antes do contato com o paciente real.",
      "icon": "Shield"
    },
    {
      "title": "Rigor Científico e Evidência",
      "description": "Substituímos a memorização de protocolos pela compreensão real. Nosso ensino e nossos feedbacks são ancorados em princípios sólidos de física médica e literatura técnica.",
      "icon": "Microscope"
    },
    {
      "title": "Evolução e Atualização Contínua",
      "description": "Mantemos uma rotina ativa de atualização de conteúdos. Exploramos e integramos o ensino de novas tecnologias, garantindo que o profissional esteja alinhado com as inovações da área.",
      "icon": "RefreshCw"
    },
    {
      "title": "Inteligência Pedagógica",
      "description": "Não entregamos respostas prontas. Utilizamos a tecnologia para provocar o questionamento técnico e fortalecer a construção do raciocínio clínico autônomo do profissional.",
      "icon": "Brain"
    },
    {
      "title": "Acesso e Escalabilidade",
      "description": "Trabalhamos para descentralizar o conhecimento, garantindo que a capacitação tecnológica não seja uma exclusividade dos grandes centros urbanos.",
      "icon": "Globe"
    }
  ]
}
$mvv$::jsonb,
  'default',
  'gradient',
  '{"from": "#ffffff", "to": "#f9fafb", "direction": "to-br"}'::jsonb,
  'fade-in',
  0,
  'lg',
  'lg',
  NULL,
  '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.about_page_sections existing WHERE existing.section_type = 'mvv'
);
