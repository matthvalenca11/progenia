-- ============================================================
-- Tornar um usuário ADMIN
-- Rode no SQL Editor do Supabase (como postgres, ignora RLS).
-- ============================================================
-- 1. Descubra o UUID do usuário:
--    Dashboard → Authentication → Users → clique no usuário → copie o "User UID"
--
-- 2. Substitua abaixo 'COLE-O-UUID-AQUI' pelo UUID e execute.

INSERT INTO public.user_roles (user_id, role)
VALUES ('COLE-O-UUID-AQUI', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Para conferir quem é admin:
-- SELECT p.email, ur.role FROM public.profiles p
-- JOIN public.user_roles ur ON ur.user_id = p.id
-- WHERE ur.role = 'admin';
