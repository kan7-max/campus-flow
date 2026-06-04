alter table public.user_settings
  add column if not exists display_name text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists preferred_available_minutes integer not null default 60,
  add column if not exists preferred_today_mode text not null default 'normal',
  add column if not exists ai_enabled boolean not null default true,
  add column if not exists google_calendar_enabled boolean not null default false,
  add column if not exists setup_course_names text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_settings_preferred_available_minutes_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_preferred_available_minutes_check
      check (preferred_available_minutes in (15, 30, 60, 120, 180));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_settings_preferred_today_mode_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_preferred_today_mode_check
      check (preferred_today_mode in ('normal', 'busy', 'low_energy', 'exam'));
  end if;
end $$;
