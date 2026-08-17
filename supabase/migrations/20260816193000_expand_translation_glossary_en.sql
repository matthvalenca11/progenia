-- Expand PT→EN glossary for UI and medical education terms (fixes machine-translation gaps)

INSERT INTO public.translation_glossary (source_lang, target_lang, source_text, target_text, priority)
VALUES
  ('pt', 'en', 'Diagnóstico por Imagem', 'Medical Imaging', 20),
  ('pt', 'en', 'diagnóstico por imagem', 'medical imaging', 20),
  ('pt', 'en', 'imagem médica', 'medical imaging', 20),
  ('pt', 'en', 'Cápsulas Rápidas', 'Quick capsules', 20),
  ('pt', 'en', 'cápsulas rápidas', 'quick capsules', 20),
  ('pt', 'en', 'Continuar de Onde Parou', 'Continue where you left off', 20),
  ('pt', 'en', 'Em alta hoje', 'Trending today', 20),
  ('pt', 'en', 'Minutos aprendidos', 'Minutes studied', 20),
  ('pt', 'en', 'Progresso no ciclo', 'Cycle progress', 20),
  ('pt', 'en', 'Resumo rápido', 'Quick summary', 20),
  ('pt', 'en', 'Explorar Módulos', 'Explore modules', 20),
  ('pt', 'en', 'Matricular-se', 'Enroll', 20),
  ('pt', 'en', 'Ver Cápsulas', 'View capsules', 20),
  ('pt', 'en', 'Ver Aulas', 'View lessons', 20),
  ('pt', 'en', 'Refazer o Módulo', 'Retake module', 20),
  ('pt', 'en', 'Voltar ao Dashboard', 'Back to dashboard', 20),
  ('pt', 'en', 'Matrícula Necessária', 'Enrollment required', 20),
  ('pt', 'en', 'Laboratórios Virtuais', 'Virtual labs', 20),
  ('pt', 'en', 'laboratório virtual', 'virtual lab', 20),
  ('pt', 'en', 'laboratórios virtuais', 'virtual labs', 20),
  ('pt', 'en', 'Progresso do Módulo', 'Module progress', 20),
  ('pt', 'en', 'aulas concluídas', 'lessons completed', 20),
  ('pt', 'en', 'módulos concluídos', 'modules completed', 20),
  ('pt', 'en', 'cápsulas concluídas', 'capsules completed', 20),
  ('pt', 'en', 'Relatar um bug', 'Report a bug', 20),
  ('pt', 'en', 'Excluir conta', 'Delete account', 20),
  ('pt', 'en', 'fotobiomodulação', 'photobiomodulation', 20),
  ('pt', 'en', 'ultrassom terapêutico', 'therapeutic ultrasound', 20),
  ('pt', 'en', 'ultrassom diagnóstico', 'diagnostic ultrasound', 20),
  ('pt', 'en', 'parâmetros', 'parameters', 20),
  ('pt', 'en', 'indicações clínicas', 'clinical indications', 20),
  ('pt', 'en', 'mecanismos biológicos', 'biological mechanisms', 20),
  ('pt', 'en', 'gráfico paramétrico', 'parametric chart', 20),
  ('pt', 'en', 'gráficos paramétricos', 'parametric charts', 20),
  ('pt', 'en', 'Em Progresso', 'In progress', 20),
  ('pt', 'en', 'Nenhuma Cápsula Disponível', 'No capsules available', 20),
  ('pt', 'en', 'Nenhum módulo disponível ainda', 'No modules available yet', 20),
  ('pt', 'en', 'Carregando seu painel', 'Loading your dashboard', 20),
  ('pt', 'en', 'O que você gostaria de aprender hoje?', 'What would you like to learn today?', 20),
  ('pt', 'en', 'Descubra o conteúdo ProGenia', 'Discover ProGenia content', 20),
  ('pt', 'en', 'Buscar conteúdos', 'Search content', 20),
  ('pt', 'en', 'Ou escolha um tema', 'Or choose a topic', 20),
  ('pt', 'en', 'Ou continue de onde parou', 'Or continue where you left off', 20),
  ('pt', 'en', 'Explorar tudo', 'Explore all', 20),
  ('pt', 'en', 'Laboratório virtual TENS', 'TENS virtual lab', 20),
  ('pt', 'en', 'Simulações práticas', 'Practical simulations', 20),
  ('pt', 'en', 'Equipamentos e protocolos', 'Equipment and protocols', 20),
  ('pt', 'en', 'Ver todos os labs', 'See all labs', 20),
  ('pt', 'en', 'fisioterapia', 'physical therapy', 20),
  ('pt', 'en', 'reabilitação', 'rehabilitation', 20),
  ('pt', 'en', 'tomografia', 'computed tomography', 20),
  ('pt', 'en', 'fusão multimodal', 'multimodal fusion', 20),
  ('pt', 'en', 'imagem por RM', 'MRI imaging', 20),
  ('pt', 'en', 'Sair', 'Log Out', 25),
  ('pt', 'en', 'Entrar', 'Sign In', 25),
  ('pt', 'en', 'Começar', 'Sign Up', 25),
  ('pt', 'en', 'Voltar', 'Back', 25)
ON CONFLICT (source_lang, target_lang, source_text) DO UPDATE
SET target_text = EXCLUDED.target_text,
    priority = EXCLUDED.priority,
    is_active = true,
    updated_at = now();

-- Invalidate stale machine translations in server cache for common broken phrases
DELETE FROM public.translation_cache
WHERE source_lang = 'pt'
  AND target_lang = 'en'
  AND (
    translated_text ILIKE '%you have%'
    OR translated_text ILIKE '%capsules quick%'
    OR translated_text ILIKE '%quick capsules%' AND source_text ILIKE '%rápidas%'
    OR length(translated_text) < length(source_text) * 0.5 AND length(source_text) > 80
  );
