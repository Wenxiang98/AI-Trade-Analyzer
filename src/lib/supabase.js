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

// ── Journal ────────────────────────────────────────────────────────────────

export async function getJournalTrades(userId) {
  const { data, error } = await supabase
    .from('journal_trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id:     row.id,
    date:   row.date,
    symbol: row.symbol,
    entry:  Number(row.entry),
    exit:   Number(row.exit_price),
    qty:    Number(row.qty),
    pnl:    Number(row.pnl || 0),
    notes:  row.notes || '',
  }));
}

export async function addJournalTrade(userId, trade) {
  const { data, error } = await supabase
    .from('journal_trades')
    .insert({
      user_id:    userId,
      date:       trade.date,
      symbol:     trade.symbol,
      entry:      trade.entry,
      exit_price: trade.exit,
      qty:        trade.qty,
      pnl:        trade.pnl,
      notes:      trade.notes || '',
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id:     data.id,
    date:   data.date,
    symbol: data.symbol,
    entry:  Number(data.entry),
    exit:   Number(data.exit_price),
    qty:    Number(data.qty),
    pnl:    Number(data.pnl || 0),
    notes:  data.notes || '',
  };
}

export async function removeJournalTrade(tradeId) {
  const { error } = await supabase
    .from('journal_trades')
    .delete()
    .eq('id', tradeId);
  if (error) throw error;
}

// ── Price alerts ───────────────────────────────────────────────────────────

export async function getAlerts(userId) {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id:          row.id,
    symbol:      row.symbol,
    targetPrice: Number(row.target_price),
    direction:   row.direction,
    triggered:   row.triggered,
  }));
}

export async function addAlert(userId, alert) {
  const { data, error } = await supabase
    .from('price_alerts')
    .insert({
      user_id:      userId,
      symbol:       alert.symbol,
      target_price: alert.targetPrice,
      direction:    alert.direction,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id:          data.id,
    symbol:      data.symbol,
    targetPrice: Number(data.target_price),
    direction:   data.direction,
    triggered:   data.triggered,
  };
}

export async function removeAlert(alertId) {
  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', alertId);
  if (error) throw error;
}

export async function markAlertTriggered(alertId) {
  const { error } = await supabase
    .from('price_alerts')
    .update({ triggered: true, triggered_at: new Date().toISOString() })
    .eq('id', alertId);
  if (error) throw error;
}

// ── Portfolio snapshots ────────────────────────────────────────────────────

export async function saveSnapshot(userId, snapshot) {
  const { error } = await supabase
    .from('portfolio_snapshots')
    .insert({
      user_id:         userId,
      total_value:     snapshot.totalValue,
      portfolio_value: snapshot.portfolioValue,
      cash:            snapshot.cash,
      cost_basis:      snapshot.costBasis,
    });
  if (error) throw error;
}

export async function getSnapshots(userId, limit = 30) {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse().map(row => ({
    date:           new Date(row.taken_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
    totalValue:     Number(row.total_value),
    portfolioValue: Number(row.portfolio_value),
    pnl:            Number(row.total_value) - Number(row.cost_basis),
  }));
}
