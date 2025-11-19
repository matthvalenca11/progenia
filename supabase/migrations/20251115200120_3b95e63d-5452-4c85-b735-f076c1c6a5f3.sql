-- Adicionar coluna para conteúdo de artigos em formato rich text
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS conteudo_rich_text TEXT;