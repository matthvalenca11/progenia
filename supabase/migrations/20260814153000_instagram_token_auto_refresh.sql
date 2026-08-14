-- Persist refresh metadata and schedule automatic Instagram token renewal.
ALTER TABLE public.instagram_connection
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_refresh_error text;

-- pg_cron + pg_net are available on hosted Supabase. Skip quietly if not.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net unavailable: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'refresh-instagram-token';

    PERFORM cron.schedule(
      'refresh-instagram-token',
      '0 8 1,15 * *',
      $cron$
      SELECT net.http_post(
        url := 'https://flhhvrhcrxvxnnbrggwt.supabase.co/functions/v1/refresh-instagram-token',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed; GitHub Action will refresh the Instagram token.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping Instagram cron schedule: %', SQLERRM;
END $$;
