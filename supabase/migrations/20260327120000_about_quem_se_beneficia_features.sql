-- "Para Quem é a ProGenia?" → grade de valor (features) com novo título e 6 cartões
UPDATE public.about_page_sections
SET
  section_type = 'features',
  title = 'Para quem o ProGenia gera valor direto',
  subtitle = NULL,
  description = NULL,
  media_url = NULL,
  media_type = NULL,
  layout = 'default',
  theme = 'gradient',
  content_data = $json$
[
  {
    "icon": "Landmark",
    "title": "Instituições de ensino em saúde",
    "description": "Padronizam o ensino prático e escalam formação com evidência de desempenho."
  },
  {
    "icon": "SquareUser",
    "title": "Coordenações e docentes",
    "description": "Rastreiam evolução por competência e direcionam intervenções pedagógicas com mais precisão."
  },
  {
    "icon": "Hospital",
    "title": "Serviços de imagem e hospitais-escola",
    "description": "Treinam equipes com menor risco e fortalecem decisões antes da prática em paciente real."
  },
  {
    "icon": "Brain",
    "title": "Clínicas de reabilitação",
    "description": "Padronizam condutas com ciência aplicada e reduzem a variabilidade entre profissionais."
  },
  {
    "icon": "GraduationCap",
    "title": "Estudantes e recém-formados",
    "description": "Reduzem a distância entre teoria e prática, com mais segurança para interpretar e decidir."
  },
  {
    "icon": "Globe",
    "title": "Formação continuada em regiões afastadas",
    "description": "Ampliam acesso à atualização em novas tecnologias sem barreira geográfica."
  }
]
$json$::jsonb,
  spacing_top = 'lg',
  spacing_bottom = 'lg'
WHERE id = 'e342ebbc-915e-40e5-8748-8a292a7ef9a1'
   OR (
     section_type IN ('text_image', 'text+image')
     AND (
       title ILIKE '%Para Quem%a ProGenia%'
       OR title ILIKE '%Para quem%ProGenia%'
     )
   );
