-- Motor tapping biomarker observations

CREATE TABLE public.motor_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_taps INTEGER NOT NULL CHECK (total_taps >= 0),
  frequency_hz NUMERIC(8, 4) NOT NULL CHECK (frequency_hz >= 0),
  fatigue_index NUMERIC(8, 4) NOT NULL CHECK (fatigue_index >= 0),
  tap_events JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tap_events) = 'array'),
  duration_seconds INTEGER NOT NULL DEFAULT 10,
  dominant_hand TEXT,
  device_platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.motor_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motor_insert_own" ON public.motor_observations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "motor_select_own" ON public.motor_observations
  FOR SELECT USING (auth.uid() = user_id);
