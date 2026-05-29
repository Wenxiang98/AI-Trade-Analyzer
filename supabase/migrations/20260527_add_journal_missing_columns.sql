-- Migration: Add missing columns to journal_trades
-- Run in: Supabase Dashboard > SQL Editor
-- Date: 2026-05-27
--
-- The live table was originally created without entry/exit_price/pnl columns.
-- This adds them safely (IF NOT EXISTS) and refreshes the schema cache.

alter table public.journal_trades
  add column if not exists entry      numeric not null default 0,
  add column if not exists exit_price numeric not null default 0,
  add column if not exists pnl        numeric not null default 0;

-- Refresh PostgREST schema cache so the new columns are visible immediately
notify pgrst, 'reload schema';
