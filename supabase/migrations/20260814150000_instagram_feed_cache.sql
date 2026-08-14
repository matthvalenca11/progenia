-- Last successful Instagram feed, served when the Graph API token expires.
CREATE TABLE IF NOT EXISTS public.instagram_feed_cache (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_feed_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read instagram feed cache" ON public.instagram_feed_cache;
CREATE POLICY "Anyone can read instagram feed cache"
  ON public.instagram_feed_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Refreshed long-lived token so the feed can renew itself without CLI secrets.
CREATE TABLE IF NOT EXISTS public.instagram_connection (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_connection ENABLE ROW LEVEL SECURITY;
