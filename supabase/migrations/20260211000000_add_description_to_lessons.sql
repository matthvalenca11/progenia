-- Adicionar coluna description à tabela lessons se não existir
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS description TEXT;
