-- Optional seed for local development

do $$
declare
  target_user uuid;
  c_math uuid;
  c_em uuid;
begin
  select id into target_user from auth.users order by created_at asc limit 1;

  if target_user is null then
    raise notice 'No auth user found. Create/login user first then run seed again.';
    return;
  end if;

  insert into public.users (id, email)
  values (target_user, coalesce((select email from auth.users where id = target_user), 'demo@example.com'))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (target_user)
  on conflict (user_id) do nothing;

  insert into public.courses (user_id, name, day_of_week, start_time, end_time, room, instructor, color, memo)
  values
    (target_user, '応用数学', 'Mon', '13:00', '14:30', 'B102', '佐藤教授', '#60a5fa', '苦手科目'),
    (target_user, '電磁気学', 'Tue', '10:40', '12:10', 'A201', '田中教授', '#38bdf8', '毎週課題あり')
  on conflict do nothing;

  select id into c_math from public.courses where user_id = target_user and name = '応用数学' limit 1;
  select id into c_em from public.courses where user_id = target_user and name = '電磁気学' limit 1;

  insert into public.assignments (
    user_id,
    course_id,
    title,
    due_at,
    assignment_type,
    submission_target,
    priority_label,
    priority_score,
    progress,
    status,
    estimated_hours,
    is_heavy,
    tags,
    memo
  )
  values
    (
      target_user,
      c_em,
      'オームの法則 実験レポート',
      now() + interval '3 days',
      'lab_report',
      'LMS',
      'high',
      88,
      25,
      'in_progress',
      5,
      true,
      array['heavy'],
      '測定値整理と考察必須'
    ),
    (
      target_user,
      c_math,
      '微分方程式 小テスト対策',
      now() + interval '6 days',
      'quiz',
      '教室',
      'high',
      79,
      0,
      'todo',
      3,
      false,
      array[]::text[],
      '範囲: 1階線形微分方程式'
    )
  on conflict do nothing;
end;
$$;
