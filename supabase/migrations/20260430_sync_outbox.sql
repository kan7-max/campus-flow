-- Calendar sync outbox for reliable external integrations.
-- Run this after the initial schema in production Supabase.

create table if not exists public.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  provider text not null default 'google',
  operation text not null check (operation in ('create_or_update', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'synced', 'failed')),
  attempts int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_outbox_status_available on public.sync_outbox (status, available_at);
create index if not exists idx_sync_outbox_user_updated on public.sync_outbox (user_id, updated_at desc);
create index if not exists idx_sync_outbox_assignment on public.sync_outbox (assignment_id);

drop trigger if exists trg_sync_outbox_updated on public.sync_outbox;
create trigger trg_sync_outbox_updated before update on public.sync_outbox
for each row execute function public.set_updated_at();

alter table public.sync_outbox enable row level security;

drop policy if exists "sync_outbox self" on public.sync_outbox;
create policy "sync_outbox self" on public.sync_outbox
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
