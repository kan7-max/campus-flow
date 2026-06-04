-- Assignment steps split heavy work into small, checkable actions.
-- Run this after the initial schema in production Supabase.

create table if not exists public.assignment_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'done')),
  estimated_minutes int not null default 25 check (estimated_minutes > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignment_steps_assignment_order on public.assignment_steps (assignment_id, sort_order);
create index if not exists idx_assignment_steps_user_status on public.assignment_steps (user_id, status, updated_at desc);

drop trigger if exists trg_assignment_steps_updated on public.assignment_steps;
create trigger trg_assignment_steps_updated before update on public.assignment_steps
for each row execute function public.set_updated_at();

alter table public.assignment_steps enable row level security;

drop policy if exists "assignment_steps self" on public.assignment_steps;
create policy "assignment_steps self" on public.assignment_steps
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
