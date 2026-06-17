-- ============================================================
-- Fix content_queue RLS so users can INSERT their own rows.
--
-- The original policy (20260609_agent_tables.sql) was:
--   CREATE POLICY "Users see own content" ON content_queue
--     FOR ALL USING (user_id = auth.uid());
--
-- A FOR ALL policy with only USING and no explicit WITH CHECK was
-- rejecting inserts in production with:
--   "new row violates row-level security policy for table content_queue"
--
-- This recreates the policy with an explicit WITH CHECK clause so
-- INSERT and UPDATE are validated against the authenticated user.
-- ============================================================

ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own content" ON content_queue;
DROP POLICY IF EXISTS "Users manage own content" ON content_queue;

CREATE POLICY "Users manage own content" ON content_queue
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
