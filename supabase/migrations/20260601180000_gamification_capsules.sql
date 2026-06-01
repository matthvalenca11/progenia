-- Gamificação: badges de cápsulas e metas mais acessíveis

ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_requirement_type_check;
ALTER TABLE public.badges ADD CONSTRAINT badges_requirement_type_check
  CHECK (requirement_type IN (
    'lessons_completed',
    'modules_completed',
    'streak_days',
    'quiz_perfect',
    'total_time',
    'capsules_completed'
  ));

UPDATE public.badges
SET requirement_value = 60,
    description = 'Estude por 1 hora no total'
WHERE name = 'Maratonista';

INSERT INTO public.badges (name, description, icon_name, requirement_type, requirement_value, points)
SELECT 'Primeira Cápsula', 'Complete sua primeira cápsula', 'Pill', 'capsules_completed', 1, 15
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'Primeira Cápsula');

INSERT INTO public.badges (name, description, icon_name, requirement_type, requirement_value, points)
SELECT 'Explorador', 'Complete 3 cápsulas', 'Compass', 'capsules_completed', 3, 40
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'Explorador');

INSERT INTO public.badges (name, description, icon_name, requirement_type, requirement_value, points)
SELECT 'Em sequência', 'Estude 3 dias seguidos', 'Flame', 'streak_days', 3, 20
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'Em sequência');

INSERT INTO public.gamification_rules (acao, pontos, descricao, ativo)
SELECT 'completar_capsula', 15, 'Pontos por completar uma cápsula', true
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_rules WHERE acao = 'completar_capsula');

INSERT INTO public.gamification_rules (acao, pontos, descricao, ativo)
SELECT 'streak_3_dias', 15, 'Bônus por 3 dias consecutivos de estudo', true
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_rules WHERE acao = 'streak_3_dias');
