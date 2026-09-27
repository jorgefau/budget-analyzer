-- =============================================================
-- Budget Analyzer — database schema
-- Paste this whole file into Supabase: SQL Editor → New query → Run
-- =============================================================

-- -------------------------------------------------------------
-- 1. Tables
-- -------------------------------------------------------------

-- Every expense a user records (manually or via CSV import)
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  txn_date    date not null,
  amount      numeric(12, 2) not null check (amount > 0),
  merchant    text not null,
  category    text not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, txn_date);

-- Monthly budget per category (month is stored as the 1st of the month)
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null,
  month       date not null check (extract(day from month) = 1),
  amount      numeric(12, 2) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  unique (user_id, category, month)
);

-- -------------------------------------------------------------
-- 2. Row Level Security — each user can only see/change their own rows
-- -------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;

create policy "Users manage their own transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 3. Analytics views (security_invoker = RLS still applies per user)
-- -------------------------------------------------------------

-- Total spending per category per month
create or replace view public.monthly_category_spending
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', txn_date)::date as month,
  category,
  sum(amount)                          as total_spent,
  count(*)                             as txn_count
from public.transactions
group by user_id, date_trunc('month', txn_date), category;

-- Budget vs. actual with variance for each budgeted category/month
create or replace view public.budget_vs_actual
with (security_invoker = true) as
select
  b.user_id,
  b.month,
  b.category,
  b.amount                                        as budgeted,
  coalesce(s.total_spent, 0)                      as actual,
  b.amount - coalesce(s.total_spent, 0)           as remaining,
  case when b.amount > 0
       then round(coalesce(s.total_spent, 0) / b.amount * 100, 1)
  end                                             as pct_used
from public.budgets b
left join public.monthly_category_spending s
  on  s.user_id  = b.user_id
  and s.month    = b.month
  and s.category = b.category;
