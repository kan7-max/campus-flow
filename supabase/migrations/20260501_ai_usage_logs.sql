-- AI usage logs are the billing/credits audit foundation.
-- Run this after the initial schema in production Supabase.

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  feature text not null check (
    feature in (
      'inbox_parse',
      'assignment_extract',
      'step_generate',
      'study_plan_generate',
      'daily_strategy_generate',
      'file_text_extract'
    )
  ),
  model text not null,
  input_tokens int,
  output_tokens int,
  credits_used int not null default 0 check (credits_used >= 0),
  status text not null check (status in ('success', 'failed', 'fallback')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_logs_user_created
on public.ai_usage_logs (user_id, created_at desc);

create index if not exists idx_ai_usage_logs_feature_created
on public.ai_usage_logs (feature, created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_logs self" on public.ai_usage_logs;
create policy "ai_usage_logs self" on public.ai_usage_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
