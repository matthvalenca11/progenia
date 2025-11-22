-- Adicionar coluna de descrição na tabela partners
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS description TEXT;