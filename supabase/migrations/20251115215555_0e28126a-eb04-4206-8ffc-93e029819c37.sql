-- Corrigir políticas RLS para user_badges
-- Permitir que usuários insiram seus próprios badges
DROP POLICY IF EXISTS "Users can insert their own badges" ON user_badges;
CREATE POLICY "Users can insert their own badges"
ON user_badges
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Garantir que a política de INSERT de lesson_progress tem WITH CHECK correto
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio progresso" ON lesson_progress;
CREATE POLICY "Usuários podem atualizar seu próprio progresso"
ON lesson_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Garantir que user_stats tem política de INSERT
DROP POLICY IF EXISTS "Users can insert their own stats" ON user_stats;
CREATE POLICY "Users can insert their own stats"
ON user_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);