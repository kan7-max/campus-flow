-- Study blocks store the rule-based daily work plan.
-- Run this after the initial schema in production Supabase.

create table if not exists public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  description text,
  planned_date date not null,
  start_time time,
  end_time time,
  duration_minutes int not null default 25 check (duration_minutes > 0),
  status text not null default 'planned' check (status in ('planned', 'started', 'completed', 'skipped', 'rescheduled')),
  source text not null default 'rule_based' check (source in ('rule_based', 'ai_generated', 'manual')),
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_blocks_user_date on public.study_blocks (user_id, planned_date, start_time);
create index if not exists idx_study_blocks_assignment on public.study_blocks (assignment_id, planned_date);
create index if not exists idx_study_blocks_status on public.study_blocks (user_id, status, planned_date);

drop trigger if exists trg_study_blocks_updated on public.study_blocks;
create trigger trg_study_blocks_updated before update on public.study_blocks
for each row execute function public.set_updated_at();

alter table public.study_blocks enable row level security;

drop policy if exists "study_blocks self" on public.study_blocks;
create policy "study_blocks self" on public.study_blocks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
