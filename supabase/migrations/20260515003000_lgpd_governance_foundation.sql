-- LGPD governance foundation:
-- - legal documents versioning
-- - user legal acceptances audit trail
-- - cookie consent records
-- - data subject requests protocol table

-- 1) Extend legal settings with structured fields (backward compatible)
ALTER TABLE public.legal_settings
ADD COLUMN IF NOT EXISTS terms_of_use_text text,
ADD COLUMN IF NOT EXISTS privacy_policy_text text,
ADD COLUMN IF NOT EXISTS cookie_policy_text text,
ADD COLUMN IF NOT EXISTS terms_version text DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS privacy_version text DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS cookies_version text DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS dpo_contact_email text,
ADD COLUMN IF NOT EXISTS dpo_contact_channel text;

-- 2) Versioned legal documents
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('terms_of_use', 'privacy_policy', 'cookie_policy')),
  language text NOT NULL DEFAULT 'pt-BR',
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, language, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type_lang_active
  ON public.legal_documents (document_type, language, is_active);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active legal documents" ON public.legal_documents;
CREATE POLICY "Public can read active legal documents"
ON public.legal_documents
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage legal documents" ON public.legal_documents;
CREATE POLICY "Admins can manage legal documents"
ON public.legal_documents
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) User legal acceptances audit trail
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN ('terms_of_use', 'privacy_policy', 'cookie_policy')),
  document_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'signup',
  ip_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_time
  ON public.legal_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can view own legal acceptances"
ON public.legal_acceptances
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Service role can insert legal acceptances"
ON public.legal_acceptances
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Admins can read legal acceptances"
ON public.legal_acceptances
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Cookie consent records
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_key text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  policy_version text NOT NULL DEFAULT 'v1',
  categories jsonb NOT NULL DEFAULT '{"essential": true, "analytics": false, "marketing": false}'::jsonb,
  consent_mode text NOT NULL DEFAULT 'banner' CHECK (consent_mode IN ('banner', 'preferences', 'migration')),
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cookie_consents_user
  ON public.cookie_consents (user_id);

CREATE INDEX IF NOT EXISTS idx_cookie_consents_consented_at
  ON public.cookie_consents (consented_at DESC);

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cookie consents" ON public.cookie_consents;
CREATE POLICY "Users can read own cookie consents"
ON public.cookie_consents
FOR SELECT
USING (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cookie consents" ON public.cookie_consents;
CREATE POLICY "Users can insert own cookie consents"
ON public.cookie_consents
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cookie consents" ON public.cookie_consents;
CREATE POLICY "Users can update own cookie consents"
ON public.cookie_consents
FOR UPDATE
USING (user_id IS NULL OR auth.uid() = user_id)
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read cookie consents" ON public.cookie_consents;
CREATE POLICY "Admins can read cookie consents"
ON public.cookie_consents
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Data subject requests (canal LGPD/DPO)
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  request_type text NOT NULL CHECK (
    request_type IN (
      'general_contact',
      'access',
      'correction',
      'deletion',
      'portability',
      'opposition',
      'consent_revocation',
      'other'
    )
  ),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'done', 'rejected')),
  channel text NOT NULL DEFAULT 'web_form',
  ip_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_email_time
  ON public.data_subject_requests (email, received_at DESC);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data subject requests" ON public.data_subject_requests;
CREATE POLICY "Users can read own data subject requests"
ON public.data_subject_requests
FOR SELECT
USING (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own data subject requests" ON public.data_subject_requests;
CREATE POLICY "Users can create own data subject requests"
ON public.data_subject_requests
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage data subject requests" ON public.data_subject_requests;
CREATE POLICY "Admins manage data subject requests"
ON public.data_subject_requests
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Seed legal documents from current legal_settings terms text
INSERT INTO public.legal_documents (document_type, language, version, title, content, is_active)
SELECT
  'terms_of_use',
  'pt-BR',
  COALESCE(ls.terms_version, 'v1'),
  'Termos de Uso',
  COALESCE(NULLIF(ls.terms_of_use_text, ''), ls.terms_privacy_text),
  true
FROM public.legal_settings ls
WHERE ls.id = '00000000-0000-0000-0000-000000000002'
  AND NOT EXISTS (
    SELECT 1
    FROM public.legal_documents d
    WHERE d.document_type = 'terms_of_use'
      AND d.language = 'pt-BR'
      AND d.version = COALESCE(ls.terms_version, 'v1')
  );

INSERT INTO public.legal_documents (document_type, language, version, title, content, is_active)
SELECT
  'privacy_policy',
  'pt-BR',
  COALESCE(ls.privacy_version, 'v1'),
  'Política de Privacidade',
  COALESCE(NULLIF(ls.privacy_policy_text, ''), ls.terms_privacy_text),
  true
FROM public.legal_settings ls
WHERE ls.id = '00000000-0000-0000-0000-000000000002'
  AND NOT EXISTS (
    SELECT 1
    FROM public.legal_documents d
    WHERE d.document_type = 'privacy_policy'
      AND d.language = 'pt-BR'
      AND d.version = COALESCE(ls.privacy_version, 'v1')
  );

INSERT INTO public.legal_documents (document_type, language, version, title, content, is_active)
SELECT
  'cookie_policy',
  'pt-BR',
  COALESCE(ls.cookies_version, 'v1'),
  'Política de Cookies',
  COALESCE(
    NULLIF(ls.cookie_policy_text, ''),
    'Esta política descreve o uso de cookies essenciais, analíticos e de preferências na plataforma ProGenia.'
  ),
  true
FROM public.legal_settings ls
WHERE ls.id = '00000000-0000-0000-0000-000000000002'
  AND NOT EXISTS (
    SELECT 1
    FROM public.legal_documents d
    WHERE d.document_type = 'cookie_policy'
      AND d.language = 'pt-BR'
      AND d.version = COALESCE(ls.cookies_version, 'v1')
  );
