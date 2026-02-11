-- ============================================================
-- Seção 6 + 7 - Só aplica em tabelas que EXISTEM
-- Rode no SQL Editor do Supabase
-- ============================================================

-- ---- profiles ----
DROP POLICY IF EXISTS "Usuários podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Usuários podem ver todos os perfis" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem criar seu próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;
CREATE POLICY "Admins podem deletar perfis" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- user_roles ----
DROP POLICY IF EXISTS "Todos podem ver roles" ON public.user_roles;
CREATE POLICY "Todos podem ver roles" ON public.user_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Apenas admins podem inserir roles" ON public.user_roles;
CREATE POLICY "Apenas admins podem inserir roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem atualizar roles" ON public.user_roles;
CREATE POLICY "Apenas admins podem atualizar roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem deletar roles" ON public.user_roles;
CREATE POLICY "Apenas admins podem deletar roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- user_stats ----
DROP POLICY IF EXISTS "Usuários podem ver suas próprias estatísticas" ON public.user_stats;
CREATE POLICY "Usuários podem ver suas próprias estatísticas" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias estatísticas" ON public.user_stats;
CREATE POLICY "Usuários podem atualizar suas próprias estatísticas" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);

-- ---- modules ----
DROP POLICY IF EXISTS "Todos podem ver módulos publicados" ON public.modules;
CREATE POLICY "Todos podem ver módulos publicados" ON public.modules FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem criar módulos" ON public.modules;
CREATE POLICY "Apenas admins podem criar módulos" ON public.modules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem atualizar módulos" ON public.modules;
CREATE POLICY "Apenas admins podem atualizar módulos" ON public.modules FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem deletar módulos" ON public.modules;
CREATE POLICY "Apenas admins podem deletar módulos" ON public.modules FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- lessons ----
DROP POLICY IF EXISTS "Todos podem ver aulas publicadas" ON public.lessons;
CREATE POLICY "Todos podem ver aulas publicadas" ON public.lessons FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem criar aulas" ON public.lessons;
CREATE POLICY "Apenas admins podem criar aulas" ON public.lessons FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem atualizar aulas" ON public.lessons;
CREATE POLICY "Apenas admins podem atualizar aulas" ON public.lessons FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem deletar aulas" ON public.lessons;
CREATE POLICY "Apenas admins podem deletar aulas" ON public.lessons FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- lesson_progress ----
DROP POLICY IF EXISTS "Usuários podem ver seu próprio progresso" ON public.lesson_progress;
CREATE POLICY "Usuários podem ver seu próprio progresso" ON public.lesson_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio progresso" ON public.lesson_progress;
CREATE POLICY "Usuários podem inserir seu próprio progresso" ON public.lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio progresso" ON public.lesson_progress;
CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON public.lesson_progress FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem deletar seu próprio progresso de aulas" ON public.lesson_progress;
CREATE POLICY "Usuários podem deletar seu próprio progresso de aulas" ON public.lesson_progress FOR DELETE USING (auth.uid() = user_id);

-- ---- module_enrollments ----
DROP POLICY IF EXISTS "Usuários podem ver suas próprias matrículas" ON public.module_enrollments;
CREATE POLICY "Usuários podem ver suas próprias matrículas" ON public.module_enrollments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem se matricular em módulos" ON public.module_enrollments;
CREATE POLICY "Usuários podem se matricular em módulos" ON public.module_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem cancelar suas matrículas" ON public.module_enrollments;
CREATE POLICY "Usuários podem cancelar suas matrículas" ON public.module_enrollments FOR DELETE USING (auth.uid() = user_id);

-- ---- capsulas ----
DROP POLICY IF EXISTS "Todos podem ver cápsulas publicadas" ON public.capsulas;
CREATE POLICY "Todos podem ver cápsulas publicadas" ON public.capsulas FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem criar cápsulas" ON public.capsulas;
CREATE POLICY "Apenas admins podem criar cápsulas" ON public.capsulas FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem atualizar cápsulas" ON public.capsulas;
CREATE POLICY "Apenas admins podem atualizar cápsulas" ON public.capsulas FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem deletar cápsulas" ON public.capsulas;
CREATE POLICY "Apenas admins podem deletar cápsulas" ON public.capsulas FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- capsula_progress (só se a tabela existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capsula_progress') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver seu próprio progresso" ON public.capsula_progress';
    EXECUTE 'CREATE POLICY "Usuários podem ver seu próprio progresso" ON public.capsula_progress FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem inserir seu próprio progresso" ON public.capsula_progress';
    EXECUTE 'CREATE POLICY "Usuários podem inserir seu próprio progresso" ON public.capsula_progress FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio progresso" ON public.capsula_progress';
    EXECUTE 'CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON public.capsula_progress FOR UPDATE USING (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem deletar seu próprio progresso de cápsulas" ON public.capsula_progress';
    EXECUTE 'CREATE POLICY "Usuários podem deletar seu próprio progresso de cápsulas" ON public.capsula_progress FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- ---- virtual_labs ----
DROP POLICY IF EXISTS "Todos podem ver labs publicados" ON public.virtual_labs;
CREATE POLICY "Todos podem ver labs publicados" ON public.virtual_labs FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem criar labs" ON public.virtual_labs;
CREATE POLICY "Apenas admins podem criar labs" ON public.virtual_labs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem atualizar labs" ON public.virtual_labs;
CREATE POLICY "Apenas admins podem atualizar labs" ON public.virtual_labs FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem deletar labs" ON public.virtual_labs;
CREATE POLICY "Apenas admins podem deletar labs" ON public.virtual_labs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- capsula_virtual_labs (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capsula_virtual_labs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem gerenciar vínculos de labs" ON public.capsula_virtual_labs';
    EXECUTE 'CREATE POLICY "Admins podem gerenciar vínculos de labs" ON public.capsula_virtual_labs FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver labs de cápsulas publicadas" ON public.capsula_virtual_labs';
    EXECUTE 'CREATE POLICY "Usuários podem ver labs de cápsulas publicadas" ON public.capsula_virtual_labs FOR SELECT USING (EXISTS (SELECT 1 FROM capsulas WHERE capsulas.id = capsula_virtual_labs.capsula_id AND capsulas.is_published = true))';
  END IF;
END $$;

-- ---- quizzes ----
DROP POLICY IF EXISTS "Todos podem ver quizzes publicados" ON public.quizzes;
CREATE POLICY "Todos podem ver quizzes publicados" ON public.quizzes FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem criar quizzes" ON public.quizzes;
CREATE POLICY "Apenas admins podem criar quizzes" ON public.quizzes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem atualizar quizzes" ON public.quizzes;
CREATE POLICY "Apenas admins podem atualizar quizzes" ON public.quizzes FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Apenas admins podem deletar quizzes" ON public.quizzes;
CREATE POLICY "Apenas admins podem deletar quizzes" ON public.quizzes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- quiz_questions (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_questions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar questões" ON public.quiz_questions';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar questões" ON public.quiz_questions FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver questões de quizzes publicados" ON public.quiz_questions';
    EXECUTE 'CREATE POLICY "Usuários podem ver questões de quizzes publicados" ON public.quiz_questions FOR SELECT USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND (quizzes.is_published = true OR has_role(auth.uid(), ''admin''::app_role))))';
  END IF;
END $$;

-- ---- quiz_options (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_options') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar opções" ON public.quiz_options';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar opções" ON public.quiz_options FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver opções de quizzes publicados" ON public.quiz_options';
    EXECUTE 'CREATE POLICY "Usuários podem ver opções de quizzes publicados" ON public.quiz_options FOR SELECT USING (EXISTS (SELECT 1 FROM quiz_questions JOIN quizzes ON quizzes.id = quiz_questions.quiz_id WHERE quiz_questions.id = quiz_options.question_id AND (quizzes.is_published = true OR has_role(auth.uid(), ''admin''::app_role))))';
  END IF;
END $$;

-- ---- quiz_attempts (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_attempts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver suas próprias tentativas" ON public.quiz_attempts';
    EXECUTE 'CREATE POLICY "Usuários podem ver suas próprias tentativas" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem ver todas tentativas" ON public.quiz_attempts';
    EXECUTE 'CREATE POLICY "Admins podem ver todas tentativas" ON public.quiz_attempts FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem criar suas próprias tentativas" ON public.quiz_attempts';
    EXECUTE 'CREATE POLICY "Usuários podem criar suas próprias tentativas" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- ---- badges (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'badges') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver badges" ON public.badges';
    EXECUTE 'CREATE POLICY "Todos podem ver badges" ON public.badges FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar badges" ON public.badges';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar badges" ON public.badges FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- ---- user_badges (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver seus próprios badges" ON public.user_badges';
    EXECUTE 'CREATE POLICY "Usuários podem ver seus próprios badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem ver todos badges de usuários" ON public.user_badges';
    EXECUTE 'CREATE POLICY "Admins podem ver todos badges de usuários" ON public.user_badges FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Sistema pode atribuir badges" ON public.user_badges';
    EXECUTE 'CREATE POLICY "Sistema pode atribuir badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- ---- partners (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partners') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver parceiros" ON public.partners';
    EXECUTE 'CREATE POLICY "Todos podem ver parceiros" ON public.partners FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar parceiros" ON public.partners';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar parceiros" ON public.partners FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- ---- team_members (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver membros da equipe" ON public.team_members';
    EXECUTE 'CREATE POLICY "Todos podem ver membros da equipe" ON public.team_members FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar membros da equipe" ON public.team_members';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar membros da equipe" ON public.team_members FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- ---- about_page_content (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'about_page_content') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver conteúdo da página Sobre" ON public.about_page_content';
    EXECUTE 'CREATE POLICY "Todos podem ver conteúdo da página Sobre" ON public.about_page_content FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem inserir conteúdo da página Sobre" ON public.about_page_content';
    EXECUTE 'CREATE POLICY "Apenas admins podem inserir conteúdo da página Sobre" ON public.about_page_content FOR INSERT WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem atualizar conteúdo da página Sobre" ON public.about_page_content';
    EXECUTE 'CREATE POLICY "Apenas admins podem atualizar conteúdo da página Sobre" ON public.about_page_content FOR UPDATE USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- ---- about_page_sections (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'about_page_sections') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver seções publicadas" ON public.about_page_sections';
    EXECUTE 'CREATE POLICY "Todos podem ver seções publicadas" ON public.about_page_sections FOR SELECT USING ((is_published = true) OR has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar seções" ON public.about_page_sections';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar seções" ON public.about_page_sections FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- ---- email_settings (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Apenas admins podem gerenciar configurações de e-mail" ON public.email_settings';
    EXECUTE 'CREATE POLICY "Apenas admins podem gerenciar configurações de e-mail" ON public.email_settings FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- ---- tissue_configs (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tissue_configs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Tissue configs are viewable by everyone" ON public.tissue_configs';
    EXECUTE 'CREATE POLICY "Tissue configs are viewable by everyone" ON public.tissue_configs FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert tissue configs" ON public.tissue_configs';
    EXECUTE 'CREATE POLICY "Admins can insert tissue configs" ON public.tissue_configs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update tissue configs" ON public.tissue_configs';
    EXECUTE 'CREATE POLICY "Admins can update tissue configs" ON public.tissue_configs FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete tissue configs" ON public.tissue_configs';
    EXECUTE 'CREATE POLICY "Admins can delete tissue configs" ON public.tissue_configs FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
  END IF;
END $$;

-- ---- tens_lab_configs (só se existir) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tens_lab_configs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem ver todas as configs TENS" ON public.tens_lab_configs';
    EXECUTE 'CREATE POLICY "Admins podem ver todas as configs TENS" ON public.tens_lab_configs FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver configs de cápsulas publicadas" ON public.tens_lab_configs';
    EXECUTE 'CREATE POLICY "Usuários podem ver configs de cápsulas publicadas" ON public.tens_lab_configs FOR SELECT USING (EXISTS (SELECT 1 FROM capsulas WHERE capsulas.id = tens_lab_configs.capsula_id AND capsulas.is_published = true))';
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem criar configs TENS" ON public.tens_lab_configs';
    EXECUTE 'CREATE POLICY "Admins podem criar configs TENS" ON public.tens_lab_configs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem atualizar configs TENS" ON public.tens_lab_configs';
    EXECUTE 'CREATE POLICY "Admins podem atualizar configs TENS" ON public.tens_lab_configs FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS "Admins podem deletar configs TENS" ON public.tens_lab_configs';
    EXECUTE 'CREATE POLICY "Admins podem deletar configs TENS" ON public.tens_lab_configs FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ''admin''::app_role))';
  END IF;
END $$;

-- ============================================================
-- 7. TRIGGERS (só em tabelas que existem)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'about_page_content') THEN
    DROP TRIGGER IF EXISTS update_about_page_content_updated_at ON public.about_page_content;
    CREATE TRIGGER update_about_page_content_updated_at BEFORE UPDATE ON public.about_page_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'about_page_sections') THEN
    DROP TRIGGER IF EXISTS update_about_page_sections_updated_at ON public.about_page_sections;
    CREATE TRIGGER update_about_page_sections_updated_at BEFORE UPDATE ON public.about_page_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capsula_progress') THEN
    DROP TRIGGER IF EXISTS update_capsula_progress_updated_at ON public.capsula_progress;
    CREATE TRIGGER update_capsula_progress_updated_at BEFORE UPDATE ON public.capsula_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capsula_virtual_labs') THEN
    DROP TRIGGER IF EXISTS update_capsula_virtual_labs_updated_at ON public.capsula_virtual_labs;
    CREATE TRIGGER update_capsula_virtual_labs_updated_at BEFORE UPDATE ON public.capsula_virtual_labs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capsulas') THEN
    DROP TRIGGER IF EXISTS update_capsulas_updated_at ON public.capsulas;
    CREATE TRIGGER update_capsulas_updated_at BEFORE UPDATE ON public.capsulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_settings') THEN
    DROP TRIGGER IF EXISTS update_email_settings_updated_at ON public.email_settings;
    CREATE TRIGGER update_email_settings_updated_at BEFORE UPDATE ON public.email_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lesson_progress') THEN
    DROP TRIGGER IF EXISTS update_lesson_progress_updated_at ON public.lesson_progress;
    CREATE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lessons') THEN
    DROP TRIGGER IF EXISTS update_lessons_updated_at ON public.lessons;
    CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modules') THEN
    DROP TRIGGER IF EXISTS update_modules_updated_at ON public.modules;
    CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partners') THEN
    DROP TRIGGER IF EXISTS update_partners_updated_at ON public.partners;
    CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
    CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quizzes') THEN
    DROP TRIGGER IF EXISTS update_quizzes_updated_at ON public.quizzes;
    CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
    DROP TRIGGER IF EXISTS update_team_members_updated_at ON public.team_members;
    CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tens_lab_configs') THEN
    DROP TRIGGER IF EXISTS update_tens_lab_configs_updated_at ON public.tens_lab_configs;
    CREATE TRIGGER update_tens_lab_configs_updated_at BEFORE UPDATE ON public.tens_lab_configs FOR EACH ROW EXECUTE FUNCTION public.update_tens_lab_configs_updated_at();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tissue_configs') THEN
    DROP TRIGGER IF EXISTS update_tissue_configs_updated_at ON public.tissue_configs;
    CREATE TRIGGER update_tissue_configs_updated_at BEFORE UPDATE ON public.tissue_configs FOR EACH ROW EXECUTE FUNCTION public.update_tissue_configs_updated_at();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_stats') THEN
    DROP TRIGGER IF EXISTS update_user_stats_updated_at ON public.user_stats;
    CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'virtual_labs') THEN
    DROP TRIGGER IF EXISTS update_virtual_labs_updated_at ON public.virtual_labs;
    CREATE TRIGGER update_virtual_labs_updated_at BEFORE UPDATE ON public.virtual_labs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- FIM
-- ============================================================
