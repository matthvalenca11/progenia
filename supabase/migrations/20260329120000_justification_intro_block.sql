-- Bloco introdutório acima dos 4 cartões (justificativa)
UPDATE public.about_page_sections
SET
  title = 'Por Que o ProGenia Existe?',
  description = 'Profissionais de saúde frequentemente utilizam tecnologias terapêuticas e diagnósticas sem compreender profundamente os princípios físicos e fisiológicos por trás delas.'
WHERE section_type = 'justification';
