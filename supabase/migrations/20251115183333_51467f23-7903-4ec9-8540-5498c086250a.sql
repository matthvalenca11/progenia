-- Adicionar campos extras para aulas e conteúdo rico
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS recursos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS descricao_curta TEXT;

-- Criar tabela de parceiros/apoiadores
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view partners"
  ON partners FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage partners"
  ON partners FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Criar tabela de membros da equipe
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view team members"
  ON team_members FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage team members"
  ON team_members FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Criar tabela de configuração de laboratórios virtuais
CREATE TABLE IF NOT EXISTS virtual_labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  lab_type TEXT NOT NULL, -- 'mri_viewer', 'ultrasound_simulator', etc
  config_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- configurações específicas do lab
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE virtual_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published labs"
  ON virtual_labs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons 
      WHERE lessons.id = virtual_labs.lesson_id 
      AND lessons.published = true
    )
  );

CREATE POLICY "Admins can manage labs"
  ON virtual_labs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at em virtual_labs
CREATE TRIGGER update_virtual_labs_updated_at
  BEFORE UPDATE ON virtual_labs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();