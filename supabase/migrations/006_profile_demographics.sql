-- Migration 006: Add height, weight, education_level to profiles
-- These demographic fields support BMI computation, MS fatigue correlation,
-- and cognitive baseline stratification by education level.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm   SMALLINT
    CHECK (height_cm >= 100 AND height_cm <= 250),
  ADD COLUMN IF NOT EXISTS weight_kg   NUMERIC(4, 1)
    CHECK (weight_kg >= 30  AND weight_kg <= 300),
  ADD COLUMN IF NOT EXISTS education_level TEXT;
