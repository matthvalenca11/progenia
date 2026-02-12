-- Token de uso único para confirmar exclusão de conta (evita depender do JWT na Edge Function)
CREATE TABLE IF NOT EXISTS public.delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delete_requests_token ON public.delete_requests(token);
CREATE INDEX IF NOT EXISTS idx_delete_requests_expires_at ON public.delete_requests(expires_at);

ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

-- Só o próprio usuário pode criar uma solicitação de exclusão para si
CREATE POLICY "Users can insert own delete request"
  ON public.delete_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Ninguém pode ler/atualizar via RLS; a Edge Function usa service role para ler e deletar
CREATE POLICY "No public read"
  ON public.delete_requests FOR SELECT TO authenticated USING (false);
CREATE POLICY "No public update"
  ON public.delete_requests FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No public delete"
  ON public.delete_requests FOR DELETE TO authenticated USING (false);

COMMENT ON TABLE public.delete_requests IS 'Tokens de uso único para fluxo de exclusão de conta (confirm-delete-account).';
