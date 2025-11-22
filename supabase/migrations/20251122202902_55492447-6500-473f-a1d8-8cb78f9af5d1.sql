-- Expandir tabela about_page_sections com personalizações avançadas
ALTER TABLE public.about_page_sections
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'default', -- 'default', 'dark', 'gradient', 'accent', 'minimal'
  ADD COLUMN IF NOT EXISTS background_gradient JSONB DEFAULT '{"from": "#ffffff", "to": "#f9fafb", "direction": "to-br"}'::jsonb,
  ADD COLUMN IF NOT EXISTS animation_type TEXT DEFAULT 'fade-in', -- 'fade-in', 'slide-up', 'scale-in', 'none'
  ADD COLUMN IF NOT EXISTS animation_delay INTEGER DEFAULT 0, -- in ms
  ADD COLUMN IF NOT EXISTS spacing_top TEXT DEFAULT 'default', -- 'none', 'sm', 'default', 'lg', 'xl'
  ADD COLUMN IF NOT EXISTS spacing_bottom TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS custom_css TEXT, -- custom CSS classes
  ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]'::jsonb; -- [{"text": "...", "link": "...", "style": "primary"}]

-- Comentário sobre section_type expandido
COMMENT ON COLUMN public.about_page_sections.section_type IS 'Tipos: hero, text, text_image, text_video, features, stats, cta, gallery, timeline, testimonials, faq, comparison';
