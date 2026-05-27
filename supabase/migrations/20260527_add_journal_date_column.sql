-- Migration: Add missing 'date' column to journal_trades
-- Run in: Supabase Dashboard > SQL Editor
-- Date: 2026-05-27
--
-- Error fixed: PGRST204 "Could not find the 'date' column of 'journal_trades'"
-- All journal trade saves were failing silently because this column was absent.

alter table public.journal_trades
  add column if not exists date date not null default current_date;
