-- Explicit grants for user-scoped tables (Supabase policy update alignment).
-- NOTE: Do not grant anon access to personal-data tables.
-- Apply via Supabase SQL Editor in production when instructed.

-- sync_outbox
revoke all on table public.sync_outbox from anon;
grant select, insert, update, delete on table public.sync_outbox to authenticated;
grant select, insert, update, delete on table public.sync_outbox to service_role;

-- work_sessions
revoke all on table public.work_sessions from anon;
grant select, insert, update, delete on table public.work_sessions to authenticated;
grant select, insert, update, delete on table public.work_sessions to service_role;

-- study_blocks
revoke all on table public.study_blocks from anon;
grant select, insert, update, delete on table public.study_blocks to authenticated;
grant select, insert, update, delete on table public.study_blocks to service_role;

-- assignment_steps
revoke all on table public.assignment_steps from anon;
grant select, insert, update, delete on table public.assignment_steps to authenticated;
grant select, insert, update, delete on table public.assignment_steps to service_role;

-- inbox_items
revoke all on table public.inbox_items from anon;
grant select, insert, update, delete on table public.inbox_items to authenticated;
grant select, insert, update, delete on table public.inbox_items to service_role;

-- ai_usage_logs
revoke all on table public.ai_usage_logs from anon;
grant select, insert, update, delete on table public.ai_usage_logs to authenticated;
grant select, insert, update, delete on table public.ai_usage_logs to service_role;

-- ai_credit_balances
revoke all on table public.ai_credit_balances from anon;
grant select, insert, update, delete on table public.ai_credit_balances to authenticated;
grant select, insert, update, delete on table public.ai_credit_balances to service_role;

