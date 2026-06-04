-- Monthly AI credit balance foundation. This does not add billing.
-- Free users start with 15 credits per month; payment/subscription logic can update plan/monthly_limit later.

create table if not exists public.ai_credit_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  monthly_limit int not null default 15 check (monthly_limit >= 0),
  credits_used int not null default 0 check (credits_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_key)
);

create index if not exists idx_ai_credit_balances_user_month
on public.ai_credit_balances (user_id, month_key);

drop trigger if exists trg_ai_credit_balances_updated on public.ai_credit_balances;
create trigger trg_ai_credit_balances_updated before update on public.ai_credit_balances
for each row execute function public.set_updated_at();

alter table public.ai_credit_balances enable row level security;

drop policy if exists "ai_credit_balances self" on public.ai_credit_balances;
create policy "ai_credit_balances self" on public.ai_credit_balances
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
