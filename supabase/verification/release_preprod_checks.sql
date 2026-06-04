-- Campus TaskFlow pre-production verification queries
-- NOTE:
--   - Run manually in Supabase SQL Editor against the intended project.
--   - Do not run destructive statements here.

-- 1) Required tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'sync_outbox',
    'work_sessions',
    'study_blocks',
    'assignment_steps',
    'inbox_items',
    'ai_usage_logs',
    'ai_credit_balances'
  )
order by table_name;

-- 2) RLS enabled flags
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'sync_outbox',
    'work_sessions',
    'study_blocks',
    'assignment_steps',
    'inbox_items',
    'ai_usage_logs',
    'ai_credit_balances'
  )
order by tablename;

-- 3) Policy list
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'sync_outbox',
    'work_sessions',
    'study_blocks',
    'assignment_steps',
    'inbox_items',
    'ai_usage_logs',
    'ai_credit_balances'
  )
order by tablename, policyname;

