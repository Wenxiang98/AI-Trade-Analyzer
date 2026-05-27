-- ============================================
-- AI Trade Desk — Supabase Database Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- Last updated: 2026-05-27
-- ============================================

-- 1. User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text not null,
  anthropic_api_key   text,
  cash                numeric not null default 0,
  created_at          timestamptz default now()
);

-- 2. Portfolio holdings
create table if not exists public.portfolio_holdings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  symbol        text not null,
  qty           numeric not null default 0,
  avg_cost      numeric not null default 0,
  current_price numeric not null default 0,
  market        text not null default 'MYR',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 3. Trading journal
create table if not exists public.journal_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        date not null default current_date,
  symbol      text not null,
  entry       numeric not null,
  exit_price  numeric not null,
  qty         numeric not null,
  pnl         numeric not null default 0,
  notes       text not null default '',
  created_at  timestamptz default now()
);

-- 4. Price alerts
create table if not exists public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  symbol       text not null,
  target_price numeric not null,
  direction    text not null check (direction in ('above', 'below')),
  triggered    boolean not null default false,
  triggered_at timestamptz,
  created_at   timestamptz default now()
);

-- 5. Portfolio snapshots (for performance chart)
create table if not exists public.portfolio_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  total_value     numeric not null default 0,
  portfolio_value numeric not null default 0,
  cash            numeric not null default 0,
  cost_basis      numeric not null default 0,
  taken_at        timestamptz not null default now()
);

-- 6. Watchlist
create table if not exists public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  symbol     text not null,
  name       text not null default '',
  exchange   text not null default '',
  created_at timestamptz default now(),
  unique (user_id, symbol)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table public.profiles           enable row level security;
alter table public.portfolio_holdings enable row level security;
alter table public.journal_trades     enable row level security;
alter table public.price_alerts       enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.watchlist          enable row level security;

-- Profiles
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Portfolio holdings
create policy "Users manage own holdings"    on public.portfolio_holdings for all using (auth.uid() = user_id);

-- Journal
create policy "Users manage own journal"     on public.journal_trades     for all using (auth.uid() = user_id);

-- Price alerts
create policy "Users manage own alerts"      on public.price_alerts       for all using (auth.uid() = user_id);

-- Snapshots
create policy "Users manage own snapshots"   on public.portfolio_snapshots for all using (auth.uid() = user_id);

-- Watchlist
create policy "Users manage own watchlist"   on public.watchlist           for all using (auth.uid() = user_id);

-- ============================================
-- Auto-create profile on new user signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
