-- ============================================
-- AI Trade Desk - Supabase Database Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  anthropic_api_key text,
  created_at  timestamptz default now()
);

-- 2. Portfolio holdings
create table if not exists public.holdings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  symbol        text not null,
  qty           numeric not null default 0,
  avg_cost      numeric not null default 0,
  current_price numeric not null default 0,
  market        text not null default 'USD',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 3. Cash balances
create table if not exists public.cash_balances (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  amount    numeric not null default 0,
  currency  text not null default 'USD'
);

-- 4. User settings
create table if not exists public.settings (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  capital    numeric not null default 1000,
  risk_pct   numeric not null default 2,
  currency   text not null default 'MYR'
);

-- 5. Trading journal
create table if not exists public.journal_trades (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  symbol    text not null,
  action    text not null check (action in ('BUY','SELL')),
  price     numeric not null,
  qty       numeric not null,
  market    text not null default 'USD',
  notes     text,
  trade_date date not null default current_date,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security (RLS) — users only see their own data
-- ============================================

alter table public.profiles        enable row level security;
alter table public.holdings        enable row level security;
alter table public.cash_balances   enable row level security;
alter table public.settings        enable row level security;
alter table public.journal_trades  enable row level security;

-- Profiles
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Holdings
create policy "Users manage own holdings" on public.holdings for all using (auth.uid() = user_id);

-- Cash
create policy "Users manage own cash" on public.cash_balances for all using (auth.uid() = user_id);

-- Settings
create policy "Users manage own settings" on public.settings for all using (auth.uid() = user_id);

-- Journal
create policy "Users manage own journal" on public.journal_trades for all using (auth.uid() = user_id);

-- ============================================
-- Auto-create profile on new user signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  insert into public.settings (user_id)
  values (new.id);

  insert into public.cash_balances (user_id, amount, currency)
  values (new.id, 0, 'MYR');

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
