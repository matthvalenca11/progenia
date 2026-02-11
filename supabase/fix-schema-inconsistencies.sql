-- ============================================================
-- CORREÇÕES DE INCONSISTÊNCIAS DE SCHEMA
-- Execute APÓS executar deep-search-bugs.sql e revisar os resultados
-- ============================================================

-- ============================================================
-- 1. MIGRAR modulo_id PARA module_id (CAPSULAS)
-- ============================================================

-- ATENÇÃO: Execute apenas se houver dados com modulo_id
-- Verifique primeiro com: SELECT COUNT(*) FROM capsulas WHERE modulo_id IS NOT NULL;

-- Passo 1: Copiar modulo_id para module_id onde module_id está NULL
UPDATE capsulas
SET module_id = modulo_id
WHERE modulo_id IS NOT NULL AND module_id IS NULL;

-- Passo 2: Verificar se há conflitos (capsulas com ambos preenchidos)
-- Se houver, você precisa decidir qual manter manualmente
SELECT 
  id,
  title,
  name,
  modulo_id,
  module_id,
  CASE 
    WHEN modulo_id != module_id THEN 'CONFLITO: valores diferentes!'
    ELSE 'OK: valores iguais'
  END as status
FROM capsulas
WHERE modulo_id IS NOT NULL AND module_id IS NOT NULL;

-- Passo 3: Remover coluna modulo_id (APENAS após confirmar que todos foram migrados)
-- ALTER TABLE capsulas DROP COLUMN IF EXISTS modulo_id;

-- ============================================================
-- 2. MIGRAR aula_id PARA lesson_id (QUIZZES)
-- ============================================================

-- ATENÇÃO: Execute apenas se houver dados com aula_id
-- Verifique primeiro com: SELECT COUNT(*) FROM quizzes WHERE aula_id IS NOT NULL;

-- Passo 1: Copiar aula_id para lesson_id onde lesson_id está NULL
UPDATE quizzes
SET lesson_id = aula_id
WHERE aula_id IS NOT NULL AND lesson_id IS NULL;

-- Passo 2: Verificar se há conflitos
SELECT 
  id,
  title,
  aula_id,
  lesson_id,
  CASE 
    WHEN aula_id != lesson_id THEN 'CONFLITO: valores diferentes!'
    ELSE 'OK: valores iguais'
  END as status
FROM quizzes
WHERE aula_id IS NOT NULL AND lesson_id IS NOT NULL;

-- Passo 3: Remover coluna aula_id (APENAS após confirmar que todos foram migrados)
-- ALTER TABLE quizzes DROP COLUMN IF EXISTS aula_id;

-- ============================================================
-- 3. SINCRONIZAR papel (profiles) COM role (user_roles)
-- ============================================================

-- Passo 1: Criar roles para usuários que têm papel mas não têm role
INSERT INTO user_roles (user_id, role)
SELECT 
  p.id,
  CASE 
    WHEN p.papel = 'admin' THEN 'admin'
    WHEN p.papel = 'instrutor' THEN 'moderator'
    ELSE 'user'
  END as role
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
WHERE p.papel IS NOT NULL 
  AND ur.role IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Passo 2: Atualizar papel para usuários que têm role mas não têm papel
UPDATE profiles p
SET papel = CASE 
  WHEN ur.role = 'admin' THEN 'admin'
  WHEN ur.role = 'moderator' THEN 'instrutor'
  ELSE 'aluno'
END
FROM user_roles ur
WHERE ur.user_id = p.id
  AND (p.papel IS NULL OR p.papel = '');

-- Passo 3: Corrigir inconsistências (papel != role)
UPDATE profiles p
SET papel = CASE 
  WHEN ur.role = 'admin' THEN 'admin'
  WHEN ur.role = 'moderator' THEN 'instrutor'
  ELSE 'aluno'
END
FROM user_roles ur
WHERE ur.user_id = p.id
  AND (
    (p.papel = 'admin' AND ur.role != 'admin') OR
    (p.papel = 'instrutor' AND ur.role NOT IN ('admin', 'moderator')) OR
    (p.papel = 'aluno' AND ur.role = 'admin')
  );

-- ============================================================
-- 4. CORRIGIR STATUS INVÁLIDOS EM PROGRESSO
-- ============================================================

-- Corrigir lesson_progress com status inválido
UPDATE lesson_progress
SET status = CASE 
  WHEN progress_percentage >= 100 THEN 'concluido'
  WHEN progress_percentage > 0 THEN 'em_progresso'
  ELSE 'nao_iniciado'
END
WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido')
   OR status IS NULL;

-- Corrigir capsula_progress com status inválido
UPDATE capsula_progress
SET status = CASE 
  WHEN progress_percentage >= 100 THEN 'concluido'
  WHEN progress_percentage > 0 THEN 'em_progresso'
  ELSE 'nao_iniciado'
END
WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido')
   OR status IS NULL;

-- Corrigir status 'concluido' com porcentagem < 100
UPDATE lesson_progress
SET progress_percentage = 100
WHERE status = 'concluido' AND progress_percentage < 100;

UPDATE capsula_progress
SET progress_percentage = 100
WHERE status = 'concluido' AND progress_percentage < 100;

-- ============================================================
-- 5. LIMPAR FOREIGN KEYS ÓRFÃS
-- ============================================================

-- ATENÇÃO: Estas queries DELETAM dados. Revise cuidadosamente antes de executar!

-- Deletar lesson_progress com lesson_id inválido
-- DELETE FROM lesson_progress
-- WHERE lesson_id IS NOT NULL 
--   AND NOT EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_progress.lesson_id);

-- Deletar capsula_progress com capsula_id inválido
-- DELETE FROM capsula_progress
-- WHERE capsula_id IS NOT NULL 
--   AND NOT EXISTS (SELECT 1 FROM capsulas WHERE capsulas.id = capsula_progress.capsula_id);

-- Deletar quizzes com lesson_id inválido
-- DELETE FROM quizzes
-- WHERE lesson_id IS NOT NULL 
--   AND NOT EXISTS (SELECT 1 FROM lessons WHERE lessons.id = quizzes.lesson_id);

-- Deletar progressos de usuários que não existem mais
-- DELETE FROM lesson_progress
-- WHERE user_id IS NOT NULL 
--   AND NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = lesson_progress.user_id);

-- DELETE FROM capsula_progress
-- WHERE user_id IS NOT NULL 
--   AND NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = capsula_progress.user_id);

-- ============================================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================================

-- Verificar se ainda há inconsistências
SELECT 'VERIFICAÇÃO FINAL' as check_type,
  (SELECT COUNT(*) FROM capsulas WHERE modulo_id IS NOT NULL AND module_id IS NULL) as capsulas_sem_module_id,
  (SELECT COUNT(*) FROM quizzes WHERE aula_id IS NOT NULL AND lesson_id IS NULL) as quizzes_sem_lesson_id,
  (SELECT COUNT(*) FROM profiles p LEFT JOIN user_roles ur ON ur.user_id = p.id WHERE p.papel IS NOT NULL AND ur.role IS NULL) as usuarios_sem_role,
  (SELECT COUNT(*) FROM lesson_progress WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido') OR status IS NULL) as lesson_progress_status_invalidos,
  (SELECT COUNT(*) FROM capsula_progress WHERE status NOT IN ('nao_iniciado', 'em_progresso', 'concluido') OR status IS NULL) as capsula_progress_status_invalidos;
