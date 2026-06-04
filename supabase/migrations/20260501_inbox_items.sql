-- Inbox items keep raw student notes before they become assignments.
-- Run this after the initial schema in production Supabase.

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  raw_text text not null check (length(trim(raw_text)) > 0),
  source_type text not null default 'manual_text' check (
    source_type in ('manual_text', 'webclass_text', 'screenshot', 'pdf', 'file', 'ai_input')
  ),
  status text not null default 'unprocessed' check (
    status in ('unprocessed', 'parsed', 'saved', 'ignored', 'failed')
  ),
  parsed_payload jsonb,
  created_assignment_id uuid references public.assignments(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inbox_items_user_status_created
on public.inbox_items (user_id, status, created_at desc);

create index if not exists idx_inbox_items_created_assignment
on public.inbox_items (created_assignment_id);

drop trigger if exists trg_inbox_items_updated on public.inbox_items;
create trigger trg_inbox_items_updated before update on public.inbox_items
for each row execute function public.set_updated_at();

alter table public.inbox_items enable row level security;

drop policy if exists "inbox_items self" on public.inbox_items;
create policy "inbox_items self" on public.inbox_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
