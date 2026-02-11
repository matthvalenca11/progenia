-- ============================================================
-- DEEP SEARCH - Busca profunda por bugs e inconsistências
-- Execute no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. INCONSISTÊNCIAS DE SCHEMA - CAPSULAS
-- ============================================================

-- NOTA: As queries abaixo podem falhar se a coluna modulo_id não existir mais.
-- Se isso acontecer, significa que a migração já foi concluída e você pode pular esta seção.

-- 1.1 Verificar se há capsulas usando modulo_id (antigo) vs module_id (novo)
-- NOTA: Se modulo_id não existir mais, esta query vai falhar. Nesse caso, comente-a.
-- Verifique primeiro se a coluna existe:
-- SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capsulas' AND column_name = 'modulo_id');
SELECT 
  'CAPSULAS COM modulo_id (ANTIGO)' as issue_type,
  id,
  title,
  modulo_id,
  module_id,
  CASE 
    WHEN modulo_id IS NOT NULL AND module_id IS NULL THEN 'USA APENAS modulo_id (ANTIGO)'
    WHEN modulo_id IS NULL AND module_id IS NOT NULL THEN 'USA APENAS module_id (NOVO)'
    WHEN modulo_id IS NOT NULL AND module_id IS NOT NULL THEN 'TEM AMBOS (CONFLITO!)'
    ELSE 'SEM NENHUM (ERRO!)'
  END as status
FROM capsulas
WHERE modulo_id IS NOT NULL OR module_id IS NULL
ORDER BY created_at;

-- 1.2 Verificar se há módulos referenciados que não existem
-- NOTA: Se modulo_id não existir mais, esta query vai falhar. Nesse caso, comente-a.
SELECT 
  'CAPSULAS COM MÓDULO INVÁLIDO (modulo_id)' as issue_type,
  c.id,
  c.title,
  c.modulo_id,
  m.id as module_exists
FROM capsulas c
LEFT JOIN modules m ON m.id = c.modulo_id
WHERE c.modulo_id IS NOT NULL AND m.id IS NULL;

SELECT 
  'CAPSULAS COM MÓDULO INVÁLIDO (module_id)' as issue_type,
  c.id,
  c.title,
  c.module_id,
  m.id as module_exists
FROM capsulas c
LEFT JOIN modules m ON m.id = c.module_id
WHERE c.module_id IS NOT NULL AND m.id IS NULL;

-- ============================================================
-- 2. INCONSISTÊNCIAS DE STATUS DE PROGRESSO
-- ============================================================

-- 2.1 Verificar valores de status inválidos em lesson_progress
SELECT 
  'LESSON_PROGRESS COM STATUS INVÁLIDO' as issue_type,
  id,
  user_id,
  lesson_id,
  status,
  progress_percentage,
  data_conclusao
FROM lesson_progress
WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido')
   OR status IS NULL;

-- 2.2 Verificar valores de status inválidos em capsula_progress
SELECT 
  'CAPSULA_PROGRESS COM STATUS INVÁLIDO' as issue_type,
  id,
  user_id,
  capsula_id,
  status,
  progress_percentage,
  data_conclusao
FROM capsula_progress
WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido')
   OR status IS NULL;

-- 2.3 Verificar progressos com porcentagem inconsistente com status
SELECT 
  'LESSON_PROGRESS: STATUS CONCLUÍDO MAS PORCENTAGEM < 100' as issue_type,
  id,
  user_id,
  lesson_id,
  status,
  progress_percentage
FROM lesson_progress
WHERE status = 'concluido' AND progress_percentage < 100;

SELECT 
  'CAPSULA_PROGRESS: STATUS CONCLUÍDO MAS PORCENTAGEM < 100' as issue_type,
  id,
  user_id,
  capsula_id,
  status,
  progress_percentage
FROM capsula_progress
WHERE status = 'concluido' AND progress_percentage < 100;

-- ============================================================
-- 3. INCONSISTÊNCIAS DE QUIZ SCHEMA
-- ============================================================

-- NOTA: As queries abaixo podem falhar se a coluna aula_id não existir mais.
-- Se isso acontecer, significa que a migração já foi concluída e você pode pular esta seção.

-- 3.1 Verificar se há quizzes usando aula_id (antigo) vs lesson_id (novo)
-- NOTA: Esta query verifica se há quizzes usando apenas aula_id (estrutura antiga).
-- Se lesson_id não existir, esta query ainda funciona mas só mostra quizzes com aula_id.
-- Verifique primeiro quais colunas existem:
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name IN ('aula_id', 'lesson_id');
SELECT 
  'QUIZZES COM aula_id (ANTIGO)' as issue_type,
  id,
  titulo as title_or_titulo,
  descricao as description_or_descricao,
  aula_id,
  CASE 
    WHEN aula_id IS NOT NULL THEN 'USA aula_id (ESTRUTURA ANTIGA)'
    ELSE 'SEM aula_id'
  END as status
FROM quizzes
WHERE aula_id IS NOT NULL
ORDER BY created_at;

-- 3.2 Verificar se há quizzes referenciando lessons que não existem
-- NOTA: Esta query verifica lesson_id (estrutura nova). Se não existir, comente esta query.
-- Verifique primeiro se a coluna existe:
-- SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'lesson_id');
-- Se lesson_id não existir, use a query abaixo que verifica aula_id:
/*
SELECT 
  'QUIZZES COM LESSON INVÁLIDO (lesson_id)' as issue_type,
  q.id,
  q.titulo as title_or_titulo,
  q.lesson_id,
  l.id as lesson_exists
FROM quizzes q
LEFT JOIN lessons l ON l.id = q.lesson_id
WHERE q.lesson_id IS NOT NULL AND l.id IS NULL;
*/

-- Alternativa: Verificar aula_id (estrutura antiga)
SELECT 
  'QUIZZES COM LESSON INVÁLIDO (aula_id)' as issue_type,
  q.id,
  q.titulo as title_or_titulo,
  q.aula_id,
  l.id as lesson_exists
FROM quizzes q
LEFT JOIN lessons l ON l.id = q.aula_id
WHERE q.aula_id IS NOT NULL AND l.id IS NULL;

-- 3.3 Verificar se há tabelas antigas de quiz ainda existindo
SELECT 
  'TABELAS ANTIGAS DE QUIZ EXISTEM?' as issue_type,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_perguntas') as quiz_perguntas_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_alternativas') as quiz_alternativas_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_tentativas') as quiz_tentativas_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_questions') as quiz_questions_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_options') as quiz_options_exists;

-- ============================================================
-- 4. INCONSISTÊNCIAS DE ROLES/PAPÉIS
-- ============================================================

-- 4.1 Verificar usuários com papel (profiles.papel) mas sem role (user_roles.role)
SELECT 
  'USUÁRIOS COM papel MAS SEM role' as issue_type,
  p.id,
  p.full_name,
  p.email,
  p.papel,
  ur.role
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
WHERE p.papel IS NOT NULL AND ur.role IS NULL;

-- 4.2 Verificar usuários com role mas sem papel
SELECT 
  'USUÁRIOS COM role MAS SEM papel' as issue_type,
  p.id,
  p.full_name,
  p.email,
  p.papel,
  ur.role
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
WHERE ur.role IS NOT NULL AND p.papel IS NULL;

-- 4.3 Verificar inconsistências entre papel e role
-- NOTA: Esta query verifica inconsistências básicas. O enum app_role pode ter valores diferentes
-- dependendo da versão (antiga: 'student', 'admin' | nova: 'admin', 'moderator', 'user').
-- Verifique primeiro quais valores existem:
-- SELECT unnest(enum_range(NULL::app_role)) as app_role_values;
SELECT 
  'INCONSISTÊNCIA ENTRE papel E role' as issue_type,
  p.id,
  p.full_name,
  p.papel,
  ur.role,
  CASE 
    WHEN p.papel = 'admin' AND ur.role != 'admin' THEN 'papel=admin mas role!=admin'
    WHEN p.papel = 'instrutor' AND ur.role = 'admin' THEN 'papel=instrutor mas role=admin (pode ser OK)'
    WHEN p.papel = 'aluno' AND ur.role = 'admin' THEN 'papel=aluno mas role=admin (INCONSISTENTE!)'
    ELSE 'OK'
  END as inconsistency
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE 
  (p.papel = 'admin' AND ur.role != 'admin') OR
  (p.papel = 'aluno' AND ur.role = 'admin');

-- ============================================================
-- 5. INCONSISTÊNCIAS DE VIRTUAL LABS (EXPANDIDO)
-- ============================================================

-- 5.1 Labs terapêuticos com config de diagnóstico
SELECT 
  'LAB TERAPÊUTICO COM CONFIG DE DIAGNÓSTICO' as issue_type,
  id,
  title,
  name,
  lab_type,
  slug,
  jsonb_object_keys(config_data) as diagnostic_keys
FROM virtual_labs
WHERE lab_type IN ('ultrasound_therapy', 'ultrassom_terapeutico')
  AND (
    config_data->>'gain' IS NOT NULL OR
    config_data->>'depth' IS NOT NULL OR
    config_data->>'layers' IS NOT NULL OR
    config_data->>'acousticLayers' IS NOT NULL OR
    config_data->>'presetId' IS NOT NULL
  )
ORDER BY created_at;

-- 5.2 Labs diagnóstico com config de terapêutico
SELECT 
  'LAB DIAGNÓSTICO COM CONFIG DE TERAPÊUTICO' as issue_type,
  id,
  title,
  name,
  lab_type,
  slug,
  jsonb_object_keys(config_data) as therapeutic_keys
FROM virtual_labs
WHERE lab_type = 'ultrasound'
  AND (
    config_data->>'era' IS NOT NULL OR
    config_data->>'dutyCycle' IS NOT NULL OR
    config_data->>'scenario' IS NOT NULL
  )
ORDER BY created_at;

-- 5.3 Labs com lab_type NULL ou vazio
SELECT 
  'LABS COM lab_type NULL/VAZIO' as issue_type,
  id,
  title,
  name,
  lab_type,
  slug,
  is_published
FROM virtual_labs
WHERE lab_type IS NULL OR lab_type = ''
ORDER BY created_at;

-- 5.4 Labs com títulos/nomes inconsistentes com lab_type
SELECT 
  'LAB COM NOME INCONSISTENTE COM lab_type' as issue_type,
  id,
  title,
  name,
  lab_type,
  slug,
  CASE 
    WHEN (title ILIKE '%terapêutico%' OR title ILIKE '%terapeutico%' OR name ILIKE '%terapêutico%' OR name ILIKE '%terapeutico%') 
         AND lab_type = 'ultrasound' THEN 'NOME TERAPÊUTICO MAS TIPO DIAGNÓSTICO'
    WHEN (title ILIKE '%diagnóstico%' OR title ILIKE '%diagnostico%' OR name ILIKE '%diagnóstico%' OR name ILIKE '%diagnostico%' OR title ILIKE '%ganho%' OR title ILIKE '%frequência%' OR title ILIKE '%carótida%')
         AND lab_type IN ('ultrasound_therapy', 'ultrassom_terapeutico') THEN 'NOME DIAGNÓSTICO MAS TIPO TERAPÊUTICO'
    ELSE 'OK'
  END as inconsistency
FROM virtual_labs
WHERE 
  (title ILIKE '%terapêutico%' OR title ILIKE '%terapeutico%' OR name ILIKE '%terapêutico%' OR name ILIKE '%terapeutico%' OR
   title ILIKE '%diagnóstico%' OR title ILIKE '%diagnostico%' OR name ILIKE '%diagnóstico%' OR name ILIKE '%diagnostico%')
ORDER BY created_at;

-- 5.5 Labs com lab_type inválido (não está no CHECK constraint)
SELECT 
  'LAB COM lab_type INVÁLIDO' as issue_type,
  id,
  title,
  name,
  lab_type,
  slug
FROM virtual_labs
WHERE lab_type NOT IN (
  'ultrasound', 'ultrasound_therapy', 'tens', 'mri', 
  'thermal', 'electrotherapy', 'ultrassom_simulador',
  'ultrassom_terapeutico', 'mri_viewer', 'eletroterapia_sim',
  'termico_sim', 'eletroterapia_dose'
)
ORDER BY created_at;

-- ============================================================
-- 6. INCONSISTÊNCIAS DE FOREIGN KEYS
-- ============================================================

-- 6.1 Lessons com module_id inválido
SELECT 
  'LESSONS COM module_id INVÁLIDO' as issue_type,
  l.id,
  l.title,
  l.module_id,
  m.id as module_exists
FROM lessons l
LEFT JOIN modules m ON m.id = l.module_id
WHERE l.module_id IS NOT NULL AND m.id IS NULL;

-- 6.2 Capsula_progress com capsula_id inválido
SELECT 
  'CAPSULA_PROGRESS COM capsula_id INVÁLIDO' as issue_type,
  cp.id,
  cp.user_id,
  cp.capsula_id,
  c.id as capsula_exists
FROM capsula_progress cp
LEFT JOIN capsulas c ON c.id = cp.capsula_id
WHERE cp.capsula_id IS NOT NULL AND c.id IS NULL;

-- 6.3 Lesson_progress com lesson_id inválido
SELECT 
  'LESSON_PROGRESS COM lesson_id INVÁLIDO' as issue_type,
  lp.id,
  lp.user_id,
  lp.lesson_id,
  l.id as lesson_exists
FROM lesson_progress lp
LEFT JOIN lessons l ON l.id = lp.lesson_id
WHERE lp.lesson_id IS NOT NULL AND l.id IS NULL;

-- ============================================================
-- 7. INCONSISTÊNCIAS DE DADOS ORFÃOS
-- ============================================================

-- 7.1 Progressos de usuários que não existem mais
SELECT 
  'LESSON_PROGRESS COM user_id INVÁLIDO' as issue_type,
  lp.id,
  lp.user_id,
  lp.lesson_id,
  u.id as user_exists
FROM lesson_progress lp
LEFT JOIN auth.users u ON u.id = lp.user_id
WHERE u.id IS NULL;

SELECT 
  'CAPSULA_PROGRESS COM user_id INVÁLIDO' as issue_type,
  cp.id,
  cp.user_id,
  cp.capsula_id,
  u.id as user_exists
FROM capsula_progress cp
LEFT JOIN auth.users u ON u.id = cp.user_id
WHERE u.id IS NULL;

-- ============================================================
-- 8. RESUMO GERAL
-- ============================================================

SELECT 
  'RESUMO DE INCONSISTÊNCIAS' as summary,
  -- NOTA: Se modulo_id não existir, estas contagens podem falhar. Comente-as se necessário.
  (SELECT COUNT(*) FROM capsulas WHERE modulo_id IS NOT NULL) as capsulas_com_modulo_id_antigo,
  (SELECT COUNT(*) FROM capsulas WHERE module_id IS NULL AND modulo_id IS NULL) as capsulas_sem_module_id,
  (SELECT COUNT(*) FROM lesson_progress WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido') OR status IS NULL) as lesson_progress_status_invalidos,
  (SELECT COUNT(*) FROM capsula_progress WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido') OR status IS NULL) as capsula_progress_status_invalidos,
  -- NOTA: Se aula_id não existir, esta contagem pode falhar. Comente-a se necessário.
  -- Se lesson_id não existir, esta query ainda funciona mas retorna 0 ou erro.
  (SELECT COUNT(*) FROM quizzes WHERE aula_id IS NOT NULL) as quizzes_com_aula_id_antigo,
  (SELECT COUNT(*) FROM virtual_labs WHERE lab_type IS NULL OR lab_type = '') as labs_sem_lab_type,
  (SELECT COUNT(*) FROM profiles p LEFT JOIN user_roles ur ON ur.user_id = p.id WHERE p.papel IS NOT NULL AND ur.role IS NULL) as usuarios_sem_role;
