-- Work sessions record actual effort and improve future planning.

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_minutes int not null default 25,
  progress_before int not null default 0,
  progress_after int,
  note text,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_sessions_user_started on public.work_sessions (user_id, started_at desc);
create index if not exists idx_work_sessions_assignment on public.work_sessions (assignment_id, started_at desc);
create index if not exists idx_work_sessions_active on public.work_sessions (user_id, assignment_id, status);

drop trigger if exists trg_work_sessions_updated on public.work_sessions;
create trigger trg_work_sessions_updated before update on public.work_sessions
for each row execute function public.set_updated_at();

alter table public.work_sessions enable row level security;

drop policy if exists "work_sessions self" on public.work_sessions;
create policy "work_sessions self" on public.work_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
