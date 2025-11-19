-- Create module enrollments table
CREATE TABLE public.module_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.module_enrollments ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollments
CREATE POLICY "Users can view their own enrollments"
ON public.module_enrollments
FOR SELECT
USING (auth.uid() = user_id);

-- Users can enroll themselves
CREATE POLICY "Users can enroll themselves"
ON public.module_enrollments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unenroll themselves
CREATE POLICY "Users can unenroll themselves"
ON public.module_enrollments
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all enrollments
CREATE POLICY "Admins can manage all enrollments"
ON public.module_enrollments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));