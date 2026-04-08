-- ============================================================
-- MasarMS: Unified schema for all 7 monitoring domains
-- Replaces: 001_observations.sql, 002_motor_observations.sql
-- ============================================================

-- Step 1: Drop old tables (acceptable — still in dev phase)
DROP TABLE IF EXISTS public.motor_observations;
DROP TABLE IF EXISTS public.observations;

-- Step 2: Domain enum
DO $$ BEGIN
  CREATE TYPE public.ms_domain AS ENUM (
    'cognitive', 'motor', 'mobility', 'fatigue', 'sleep', 'mood', 'physiological'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 3: Phase enum
DO $$ BEGIN
  CREATE TYPE public.monitoring_phase AS ENUM ('baseline', 'longitudinal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 4: Profiles table
-- PII (name/email) lives only in auth.users.
-- This table holds clinical metadata indexed by the same UUID — zero PII stored here.
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ms_phenotype          TEXT CHECK (ms_phenotype IN ('RRMS', 'SPMS', 'PPMS', 'PRMS')),
  baseline_completed_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Unified test_results table
-- `data` is a JSONB column that stores the test-specific scientific metrics.
-- Adding a new test type never requires a schema change — just a new data shape.
CREATE TABLE IF NOT EXISTS public.test_results (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain          public.ms_domain NOT NULL,
  test_type       TEXT NOT NULL,   -- e.g. 'eSDMT', 'FingerTapping', '2MWT'
  phase           public.monitoring_phase NOT NULL DEFAULT 'longitudinal',
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_platform TEXT,
  app_version     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for time-series queries per user + domain
CREATE INDEX IF NOT EXISTS idx_test_results_user_domain
  ON public.test_results (user_id, domain, created_at DESC);

-- Index for per-test-type queries
CREATE INDEX IF NOT EXISTS idx_test_results_user_type
  ON public.test_results (user_id, test_type, created_at DESC);

-- GIN index enables fast JSONB key/value searches (e.g. data->>'score_pct' > '80')
CREATE INDEX IF NOT EXISTS idx_test_results_data
  ON public.test_results USING GIN (data);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "results_insert_own" ON public.test_results;
DROP POLICY IF EXISTS "results_select_own" ON public.test_results;

CREATE POLICY "results_insert_own" ON public.test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "results_select_own" ON public.test_results
  FOR SELECT USING (auth.uid() = user_id);

-- Step 6: Passive monitoring table
-- Stores background sensor streams (keystroke dynamics, GPS life-space).
-- `collected_at` = device capture time; `created_at` = server receipt time.
CREATE TABLE IF NOT EXISTS public.passive_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,   -- 'keystroke_dynamics' | 'gps_life_space'
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passive_events_user_type
  ON public.passive_events (user_id, event_type, collected_at DESC);

ALTER TABLE public.passive_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "passive_insert_own" ON public.passive_events;
DROP POLICY IF EXISTS "passive_select_own" ON public.passive_events;

CREATE POLICY "passive_insert_own" ON public.passive_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "passive_select_own" ON public.passive_events
  FOR SELECT USING (auth.uid() = user_id);
