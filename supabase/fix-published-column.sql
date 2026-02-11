-- Rode ESTE script no SQL Editor do Supabase ANTES da seção 6.
-- Garante que todas as tabelas que EXISTEM tenham a coluna "is_published".
-- (Ignora tabelas que ainda não foram criadas.)

DO $$
BEGIN
  -- modules
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modules') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'published') THEN
      ALTER TABLE public.modules RENAME COLUMN published TO is_published;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'is_published') THEN
      ALTER TABLE public.modules ADD COLUMN is_published boolean DEFAULT false;
    END IF;
  END IF;

  -- lessons
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lessons') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'published') THEN
      ALTER TABLE public.lessons RENAME COLUMN published TO is_published;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'is_published') THEN
      ALTER TABLE public.lessons ADD COLUMN is_published boolean DEFAULT false;
    END IF;
  END IF;

  -- capsulas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capsulas') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capsulas' AND column_name = 'published') THEN
      ALTER TABLE public.capsulas RENAME COLUMN published TO is_published;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capsulas' AND column_name = 'is_published') THEN
      ALTER TABLE public.capsulas ADD COLUMN is_published boolean DEFAULT false;
    END IF;
  END IF;

  -- virtual_labs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'virtual_labs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'virtual_labs' AND column_name = 'published') THEN
      ALTER TABLE public.virtual_labs RENAME COLUMN published TO is_published;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'virtual_labs' AND column_name = 'is_published') THEN
      ALTER TABLE public.virtual_labs ADD COLUMN is_published boolean DEFAULT false;
    END IF;
  END IF;

  -- quizzes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quizzes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'published') THEN
      ALTER TABLE public.quizzes RENAME COLUMN published TO is_published;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'is_published') THEN
      ALTER TABLE public.quizzes ADD COLUMN is_published boolean DEFAULT false;
    END IF;
  END IF;

  -- about_page_sections (só altera se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'about_page_sections') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'about_page_sections' AND column_name = 'published') THEN
      ALTER TABLE public.about_page_sections RENAME COLUMN published TO is_published;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'about_page_sections' AND column_name = 'is_published') THEN
      ALTER TABLE public.about_page_sections ADD COLUMN is_published boolean DEFAULT true;
    END IF;
  END IF;
END $$;
