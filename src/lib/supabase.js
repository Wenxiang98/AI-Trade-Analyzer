import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateApiKey(userId, apiKey) {
  const { error } = await supabase
    .from('profiles')
    .update({ anthropic_api_key: apiKey })
    .eq('id', userId);
  if (error) throw error;
}

export async function saveCash(userId, cash) {
  const { error } = await supabase
    .from('profiles')
    .update({ cash })
    .eq('id', userId);
  if (error) throw error;
}

// ── Portfolio helpers ──────────────────────────────────────────────────────

function rowToHolding(row) {
  return {
    id:           row.id,
    symbol:       row.symbol,
    qty:          Number(row.qty),
    avgCost:      Number(row.avg_cost),
    currentPrice: Number(row.current_price ?? row.avg_cost),
    market:       row.market || 'MYR',
  };
}

// ── Portfolio CRUD ─────────────────────────────────────────────────────────

export async function getPortfolio(userId) {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return (data || []).map(rowToHolding);
}

export async function addHolding(userId, holding) {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .insert({
      user_id:       userId,
      symbol:        holding.symbol,
      qty:           holding.qty,
      avg_cost:      holding.avgCost,
      current_price: holding.currentPrice || holding.avgCost,
      market:        holding.market || 'MYR',
    })
    .select()
    .single();
  if (error) throw error;
  return rowToHolding(data);
}

export async function removeHolding(holdingId) {
  const { error } = await supabase
    .from('portfolio_holdings')
    .delete()
    .eq('id', holdingId);
  if (error) throw error;
}

export async function updateHoldingPrice(holdingId, currentPrice) {
  const { error } = await supabase
    .from('portfolio_holdings')
    .update({ current_price: currentPrice, updated_at: new Date().toISOString() })
    .eq('id', holdingId);
  if (error) throw error;
}

/**
 * Replace all holdings for a user — used for CSV import.
 * Deletes everything then bulk inserts the new list.
 */
export async function replacePortfolio(userId, holdings) {
  const { error: delError } = await supabase
    .from('portfolio_holdings')
    .delete()
    .eq('user_id', userId);
  if (delError) throw delError;

  if (!holdings.length) return [];

  const rows = holdings.map(h => ({
    user_id:       userId,
    symbol:        h.symbol,
    qty:           h.qty,
    avg_cost:      h.avgCost,
    current_price: h.currentPrice || h.avgCost,
    market:        h.market || 'MYR',
  }));

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data || []).map(rowToHolding);
}
