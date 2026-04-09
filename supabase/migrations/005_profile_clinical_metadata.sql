-- ============================================================
-- MasarMS: Add clinical metadata columns to profiles
-- Stores onboarding fields captured during profile setup.
-- created_at (from 003) serves as enrolled_at for the
-- 84-day (12-week) baseline induction countdown.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS years_since_diagnosis SMALLINT
    CHECK (years_since_diagnosis >= 0),
  ADD COLUMN IF NOT EXISTS edss_score            NUMERIC(3, 1)
    CHECK (edss_score >= 0 AND edss_score <= 10),
  ADD COLUMN IF NOT EXISTS age                   SMALLINT
    CHECK (age >= 18 AND age <= 65);
