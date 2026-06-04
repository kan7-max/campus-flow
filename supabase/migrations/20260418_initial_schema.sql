-- Campus TaskFlow initial schema
-- Date: 2026-04-18

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'assignment_type'
  ) then
    create type public.assignment_type as enum (
      'report',
      'quiz',
      'homework',
      'presentation',
      'lab_report',
      'exam',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'assignment_status'
  ) then
    create type public.assignment_status as enum ('todo', 'in_progress', 'done');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'priority_label'
  ) then
    create type public.priority_label as enum ('high', 'medium', 'low');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_channel'
  ) then
    create type public.notification_channel as enum ('email', 'web_push');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_status'
  ) then
    create type public.notification_status as enum ('queued', 'sent', 'failed');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'sync_status'
  ) then
    create type public.sync_status as enum ('pending', 'synced', 'failed');
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  day_of_week text not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  start_time time not null,
  end_time time not null,
  room text,
  instructor text,
  color text not null default '#38bdf8',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  due_at timestamptz not null,
  submission_target text,
  assignment_type public.assignment_type not null default 'report',
  memo text,
  priority_label public.priority_label not null default 'medium',
  priority_score int not null default 0,
  progress int not null default 0 check (progress in (0, 25, 50, 75, 100)),
  status public.assignment_status not null default 'todo',
  url text,
  estimated_hours int not null default 1,
  ai_source_text text,
  ai_confidence numeric(4,3),
  is_heavy boolean not null default false,
  tags text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_tags (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, tag)
);

create table if not exists public.course_tags (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (course_id, tag)
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_sync_records (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'google',
  external_event_id text,
  sync_status public.sync_status not null default 'pending',
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, provider)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  channel public.notification_channel not null,
  notify_at timestamptz not null,
  delivered_at timestamptz,
  status public.notification_status not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_extraction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null,
  source_text text not null,
  extracted_json jsonb not null,
  confidence_avg numeric(4,3),
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  timezone text not null default 'Asia/Tokyo',
  theme text not null default 'dark',
  priority_weights jsonb not null default '{"dueSoonWeight":0.35,"assignmentTypeWeight":0.2,"heavyWeight":0.16,"estimatedHoursWeight":0.12,"progressWeight":0.12,"weakSubjectWeight":0.05}',
  notification_config jsonb not null default '{"email":true,"webPush":true,"oneWeek":true,"threeDays":true,"oneDay":true,"sameDayMorning":true}',
  google_access_token text,
  google_refresh_token text,
  google_token_expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_user_due on public.assignments (user_id, due_at);
create index if not exists idx_assignments_course on public.assignments (course_id);
create index if not exists idx_assignments_status on public.assignments (status);
create index if not exists idx_notifications_status_notify_at on public.notifications (status, notify_at);
create index if not exists idx_subtasks_assignment on public.subtasks (assignment_id, order_index);
create index if not exists idx_calendar_sync_assignment on public.calendar_sync_records (assignment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_courses_updated on public.courses;
create trigger trg_courses_updated before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists trg_assignments_updated on public.assignments;
create trigger trg_assignments_updated before update on public.assignments
for each row execute function public.set_updated_at();

drop trigger if exists trg_subtasks_updated on public.subtasks;
create trigger trg_subtasks_updated before update on public.subtasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_calendar_sync_records_updated on public.calendar_sync_records;
create trigger trg_calendar_sync_records_updated before update on public.calendar_sync_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_notifications_updated on public.notifications;
create trigger trg_notifications_updated before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated on public.user_settings;
create trigger trg_user_settings_updated before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_push_subscriptions_updated on public.push_subscriptions;
create trigger trg_push_subscriptions_updated before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_tags enable row level security;
alter table public.course_tags enable row level security;
alter table public.subtasks enable row level security;
alter table public.attachments enable row level security;
alter table public.calendar_sync_records enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_extraction_logs enable row level security;
alter table public.user_settings enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "users self" on public.users;
create policy "users self" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "courses self" on public.courses;
create policy "courses self" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "assignments self" on public.assignments;
create policy "assignments self" on public.assignments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "assignment_tags self" on public.assignment_tags;
create policy "assignment_tags self" on public.assignment_tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "course_tags self" on public.course_tags;
create policy "course_tags self" on public.course_tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "attachments self" on public.attachments;
create policy "attachments self" on public.attachments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "calendar_sync_records self" on public.calendar_sync_records;
create policy "calendar_sync_records self" on public.calendar_sync_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications self" on public.notifications;
create policy "notifications self" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_extraction_logs self" on public.ai_extraction_logs;
create policy "ai_extraction_logs self" on public.ai_extraction_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_settings self" on public.user_settings;
create policy "user_settings self" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions self" on public.push_subscriptions;
create policy "push_subscriptions self" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subtasks via assignment" on public.subtasks;
create policy "subtasks via assignment" on public.subtasks
for all
using (
  exists (
    select 1
    from public.assignments a
    where a.id = subtasks.assignment_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = subtasks.assignment_id
      and a.user_id = auth.uid()
  )
);
