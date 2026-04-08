-- ============================================================
-- MasarMS: RLS hardening + baseline phase helper function
-- ============================================================

-- ── Fix: profiles UPDATE policy was missing WITH CHECK ──────
-- Without WITH CHECK, a user could submit an UPDATE that sets
-- id = another_user_uuid. The PK constraint blocks it, but
-- the policy should enforce it explicitly before it hits the DB.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── Prevent accidental deletes of clinical records ──────────
-- test_results are append-only. No user or service role should
-- delete rows via the Data API. Omitting a DELETE policy
-- achieves this — RLS blocks it by default when no policy matches.
-- (Documented intent: explicit non-action.)

-- ── Baseline phase helper function ──────────────────────────
-- Returns 'baseline' if the user enrolled < 12 weeks ago,
-- else 'longitudinal'. Called from the TypeScript layer via RPC
-- as a fallback, but the primary logic lives client-side.
CREATE OR REPLACE FUNCTION public.resolve_monitoring_phase(p_user_id UUID)
RETURNS public.monitoring_phase
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrolled_at TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO enrolled_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF enrolled_at IS NULL THEN
    RETURN 'longitudinal';
  END IF;

  IF (NOW() - enrolled_at) < INTERVAL '84 days' THEN
    RETURN 'baseline';
  END IF;

  RETURN 'longitudinal';
END;
$$;

-- ── RLS verification queries (run these in the SQL editor) ───
-- 1. Confirm RLS is enabled on all clinical tables:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN ('profiles', 'test_results', 'passive_events');
--
-- 2. List all policies:
--    SELECT tablename, policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--    ORDER BY tablename, policyname;
--
-- 3. Impersonation test (paste into SQL editor, set the UUID):
--    SET LOCAL role authenticated;
--    SET LOCAL request.jwt.claims TO '{"sub": "<user-uuid-here>", "role": "authenticated"}';
--    SELECT * FROM test_results;
--    -- Should only return rows where user_id = the UUID above.
