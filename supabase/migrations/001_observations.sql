-- Observations table for eSDMT (and future tests)
-- Run this in the Supabase SQL editor or via `supabase db push`

CREATE TABLE public.observations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_type       TEXT NOT NULL,                    -- 'esdmt'
  test_version    TEXT NOT NULL DEFAULT '1.0',
  total_attempts  INTEGER NOT NULL,
  correct_matches INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 90,
  score_pct       NUMERIC(5,2) GENERATED ALWAYS AS (
                    CASE WHEN total_attempts = 0 THEN 0
                         ELSE ROUND(correct_matches::NUMERIC / total_attempts * 100, 2)
                    END
                  ) STORED,
  device_platform TEXT,                             -- 'ios' | 'android' | 'web'
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

-- Per-user insert: only insert rows for own user_id
CREATE POLICY "insert_own" ON public.observations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Per-user select: only read own rows
CREATE POLICY "select_own" ON public.observations
  FOR SELECT USING (auth.uid() = user_id);

-- HIPAA/GDPR notes:
-- • No PHI stored — only UUID, scores, timestamps
-- • Transport: HTTPS enforced by Supabase (TLS 1.2+)
-- • At-rest encryption: handled by Supabase platform
-- • RLS prevents cross-user data access
-- • score_pct is computed server-side to prevent client manipulation
