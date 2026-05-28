import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import { TrendingUp, Wallet, Search, Calculator, MessageSquare, BookOpen, LayoutDashboard, Plus, Trash2, Send, Loader2, AlertTriangle, Target, Shield, Zap, RefreshCw, X, Settings, LogOut, Eye, Newspaper, DollarSign, Activity, Printer } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase, getProfile, updateApiKey, getPortfolio, addHolding, removeHolding, updateHoldingPrice, replacePortfolio, saveCash, getJournalTrades, addJournalTrade, removeJournalTrade, getAlerts, addAlert, removeAlert, markAlertTriggered, saveSnapshot, getSnapshots, getWatchlist, addToWatchlist, removeFromWatchlist } from './lib/supabase';
import LoginScreen from './components/LoginScreen';

const COLORS = {
  bg: '#0a0a0a',
  panel: '#141414',
  panelLight: '#1a1a1a',
  border: '#262626',
  text: '#e5e5e5',
  textDim: '#737373',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];

// ===== STORAGE (localStorage — settings only, not portfolio) =====
const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
  }
};

// ===== CLAUDE MODELS =====
const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5',  label: 'Haiku 4.5',  badge: '$1/MTok',    color: '#10b981' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', badge: '$3/MTok',    color: '#3b82f6' },
  { id: 'claude-opus-4-7',   label: 'Opus 4.7',   badge: '$5/MTok',    color: '#a855f7' },
];
const DEFAULT_MODEL = 'claude-haiku-4-5';

// ===== BACKEND API =====
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function searchSymbols(query) {
  if (!query || query.trim().length < 1) return [];
  try {
    const res = await fetch(`${API_BASE}/api/market/search?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchLivePrice(symbol) {
  try {
    const res = await fetch(`${API_BASE}/api/market/quote/${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.error ? null : data;
  } catch {
    return null;
  }
}

async function fetchLivePrices(symbols) {
  if (!symbols.length) return {};
  // Fire individual calls in parallel, keyed by the ORIGINAL holding symbol.
  // The batch endpoint returns normalised symbols (e.g. SUNREIT → 5176.KL) which
  // don't match what's stored in the portfolio, so batch lookups silently miss.
  try {
    const entries = await Promise.all(
      symbols.map(async sym => [sym, await fetchLivePrice(sym)])
    );
    const map = {};
    entries.forEach(([sym, data]) => {
      if (data && !data.error) map[sym] = data;
    });
    return map;
  } catch {
    return {};
  }
}

// ===== CLAUDE API =====
async function callClaude(prompt, maxTokens = 1500, apiKey = null) {
  const key   = apiKey || localStorage.getItem('anthropic_api_key');
  const model = localStorage.getItem('claude_model') || DEFAULT_MODEL;
  if (!key) {
    throw new Error('API key not set. Click the gear icon to add your Anthropic API key.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function parseJSON(text) {
  if (!text) return null;
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  let jsonStr = cleaned.slice(start, end + 1);
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    return null;
  }
}

// ===== AUTH WRAPPER =====
export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    try {
      const p = await getProfile(userId);
      setProfile(p);
      if (p?.anthropic_api_key) localStorage.setItem('anthropic_api_key', p.anthropic_api_key);
    } catch {}
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('anthropic_api_key');
  }

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} color='#3b82f6' style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  if (!session) return <LoginScreen />;

  return <TradeDesk session={session} profile={profile} onSignOut={handleSignOut} />;
}

// ===== TRADE DESK =====
function TradeDesk({ session, profile, onSignOut }) {
  const userName = profile?.name || session.user.email?.split('@')[0] || 'Trader';
  const userId   = session.user.id;

  const [tab,              setTab]              = useState('dashboard');
  const [holdings,         setHoldings]         = useState([]);
  const [cash,             setCash]             = useState(0);
  const [capital,          setCapital]          = useState(() => storage.get('settings:capital', 1000));
  const [riskPct,          setRiskPct]          = useState(() => storage.get('settings:riskPct', 2));
  const [trades,           setTrades]           = useState([]);
  const [alerts,           setAlerts]           = useState([]);
  const [snapshots,        setSnapshots]        = useState([]);
  const [triggeredAlerts,  setTriggeredAlerts]  = useState([]);
  const [watchlist,        setWatchlist]        = useState([]);
  const [analyzerPreFill,  setAnalyzerPreFill]  = useState(null);
  const [showSettings,     setShowSettings]     = useState(false);
  const [refreshing,       setRefreshing]       = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [lastRefreshed,    setLastRefreshed]    = useState(null);
  const [autoRefreshMins,  setAutoRefreshMins]  = useState(() => storage.get('settings:autoRefresh', 5));
  const [usdMyr,           setUsdMyr]           = useState(4.40);   // live USD/MYR rate, fallback 4.40
  const cashSaveRef    = useRef(null);
  const refreshFnRef   = useRef(null);

  // ── Settings in localStorage (device-specific) ────────────────────────────
  useEffect(() => { storage.set('settings:capital', capital); }, [capital]);
  useEffect(() => { storage.set('settings:riskPct', riskPct); }, [riskPct]);
  useEffect(() => { storage.set('settings:autoRefresh', autoRefreshMins); }, [autoRefreshMins]);

  // Fetch live USD/MYR FX rate once on mount (frankfurter.app — free, no auth)
  useEffect(() => {
    fetch('https://api.frankfurter.app/latest?from=USD&to=MYR')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rates?.MYR) setUsdMyr(Math.round(d.rates.MYR * 100) / 100); })
      .catch(() => {}); // keep 4.40 fallback on error
  }, []);

  // ── Load all data from Supabase on login ───────────────────────────────────
  useEffect(() => {
    (async () => {
      setPortfolioLoading(true);
      try {
        const [rows, prof, journalRows, alertRows, snapshotRows, watchRows] = await Promise.all([
          getPortfolio(userId),
          getProfile(userId),
          getJournalTrades(userId),
          getAlerts(userId),
          getSnapshots(userId, 30),
          getWatchlist(userId),
        ]);
        setHoldings(rows);
        setCash(Number(prof?.cash ?? 0));
        setTrades(journalRows);
        setAlerts(alertRows);
        setSnapshots(snapshotRows);
        setWatchlist(watchRows);
      } catch (e) { console.error('Failed to load data:', e); }
      setPortfolioLoading(false);
    })();
  }, [userId]);

  // ── Auto-refresh interval ──────────────────────────────────────────────────
  useEffect(() => { refreshFnRef.current = refreshPrices; });
  useEffect(() => {
    if (!autoRefreshMins) return;
    const id = setInterval(() => refreshFnRef.current?.(), autoRefreshMins * 60 * 1000);
    return () => clearInterval(id);
  }, [autoRefreshMins]);

  // ── Cash change — debounced save ───────────────────────────────────────────
  const handleCashChange = (val) => {
    const num = parseFloat(val) || 0;
    setCash(num);
    clearTimeout(cashSaveRef.current);
    cashSaveRef.current = setTimeout(() => saveCash(userId, num).catch(console.error), 800);
  };

  // ── Holdings mutations ─────────────────────────────────────────────────────
  const handleAddHolding = async (holdingData) => {
    try {
      const saved = await addHolding(userId, holdingData);
      setHoldings(prev => [...prev, saved]);
    } catch (e) { console.error('Add holding failed:', e); }
  };

  const handleRemoveHolding = async (holdingId) => {
    try {
      await removeHolding(holdingId);
      setHoldings(prev => prev.filter(h => h.id !== holdingId));
    } catch (e) { console.error('Remove holding failed:', e); }
  };

  const handleUpdatePrice = (holdingId, price) => {
    setHoldings(prev => prev.map(h => h.id === holdingId ? { ...h, currentPrice: parseFloat(price) || h.currentPrice } : h));
  };

  const handleUpdatePriceBlur = (holdingId, price) => {
    const p = parseFloat(price) || 0;
    if (p > 0) updateHoldingPrice(holdingId, p).catch(console.error);
  };

  const handleReplacePortfolio = async (newHoldings) => {
    const saved = await replacePortfolio(userId, newHoldings);
    setHoldings(saved);
  };

  // ── Journal mutations ──────────────────────────────────────────────────────
  const handleAddTrade = async (trade) => {
    try {
      const saved = await addJournalTrade(userId, trade);
      setTrades(prev => [saved, ...prev]);
    } catch (e) { console.error('Add trade failed:', e); }
  };

  const handleRemoveTrade = async (tradeId) => {
    try {
      await removeJournalTrade(tradeId);
      setTrades(prev => prev.filter(t => t.id !== tradeId));
    } catch (e) { console.error('Remove trade failed:', e); }
  };

  // ── Alert mutations ────────────────────────────────────────────────────────
  const handleAddAlert = async (alertData) => {
    try {
      const saved = await addAlert(userId, alertData);
      setAlerts(prev => [saved, ...prev]);
    } catch (e) { console.error('Add alert failed:', e); }
  };

  const handleRemoveAlert = async (alertId) => {
    try {
      await removeAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) { console.error('Remove alert failed:', e); }
  };

  // ── Watchlist mutations ────────────────────────────────────────────────────
  const handleAddToWatchlist = async (item) => {
    try {
      const saved = await addToWatchlist(userId, item);
      setWatchlist(prev => prev.some(w => w.symbol === saved.symbol) ? prev : [...prev, saved]);
    } catch (e) { console.error('Add to watchlist failed:', e); }
  };

  const handleRemoveFromWatchlist = async (itemId) => {
    try {
      await removeFromWatchlist(itemId);
      setWatchlist(prev => prev.filter(w => w.id !== itemId));
    } catch (e) { console.error('Remove from watchlist failed:', e); }
  };

  const handleAnalyzeFromWatchlist = (symbol, name) => {
    setAnalyzerPreFill({ symbol, name: name || '' });
    setTab('analyzer');
  };

  // ── Live price refresh + alert check + snapshot ────────────────────────────
  const refreshPrices = async () => {
    const currentHoldings = holdings;
    const symbols = currentHoldings.map(h => h.symbol).filter(Boolean);
    if (!symbols.length) return;
    setRefreshing(true);
    try {
      const entries = await Promise.all(symbols.map(async sym => [sym, await fetchLivePrice(sym)]));
      const updates = {};
      entries.forEach(([sym, data]) => { if (data?.price) updates[sym] = data.price; });

      setHoldings(prev => prev.map(h => ({ ...h, currentPrice: updates[h.symbol] ?? h.currentPrice })));
      await Promise.all(currentHoldings.filter(h => updates[h.symbol]).map(h => updateHoldingPrice(h.id, updates[h.symbol])));

      // Check price alerts
      const activeAlerts = alerts.filter(a => !a.triggered);
      const fired = [];
      for (const alert of activeAlerts) {
        const price = updates[alert.symbol];
        if (price == null) continue;
        const hit = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
        if (hit) {
          fired.push({ ...alert, currentPrice: price });
          markAlertTriggered(alert.id).catch(console.error);
          setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, triggered: true } : a));
        }
      }
      if (fired.length) setTriggeredAlerts(prev => [...prev, ...fired]);

      // Save portfolio snapshot (values in MYR — US holdings converted via live FX rate)
      const portfolioVal = currentHoldings.reduce((sum, h) => sum + toMYR(h.symbol, h.qty * (updates[h.symbol] ?? h.currentPrice)), 0);
      const costBasis    = currentHoldings.reduce((sum, h) => sum + toMYR(h.symbol, h.qty * h.avgCost), 0);
      await saveSnapshot(userId, { totalValue: portfolioVal + cash, portfolioValue: portfolioVal, cash, costBasis });
      const snap = {
        date:       new Date().toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
        totalValue: portfolioVal + cash,
        pnl:        portfolioVal - costBasis,
      };
      setSnapshots(prev => [...prev.slice(-29), snap]);
      setLastRefreshed(new Date());
    } catch (e) { console.error('Price refresh failed:', e); }
    setRefreshing(false);
  };

  // Convert a USD value to MYR for non-Malaysian symbols
  const toMYR = (symbol, val) =>
    symbol?.toUpperCase().endsWith('.KL') ? val : val * usdMyr;

  const portfolioValue = holdings.reduce((sum, h) => sum + toMYR(h.symbol, h.qty * h.currentPrice), 0);
  const totalCost      = holdings.reduce((sum, h) => sum + toMYR(h.symbol, h.qty * h.avgCost), 0);
  const positionPL     = portfolioValue - totalCost;
  const totalAssets    = portfolioValue + cash;

  const tabs = [
    { id: 'dashboard',  label: 'Dashboard', icon: LayoutDashboard },
    { id: 'watchlist',  label: 'Watchlist', icon: Eye },
    { id: 'analyzer',   label: 'Analyzer',  icon: Search },
    { id: 'portfolio',  label: 'Portfolio', icon: Wallet },
    { id: 'dividends',  label: 'Dividends', icon: DollarSign },
    { id: 'sizing',     label: 'Sizing',    icon: Calculator },
    { id: 'options',    label: 'Options',   icon: Activity },
    { id: 'chat',       label: 'AI Chat',   icon: MessageSquare },
    { id: 'journal',    label: 'Journal',   icon: BookOpen },
  ];

  return (
    <div className="min-h-screen text-neutral-200" style={{ background: COLORS.bg, fontFamily: 'system-ui, sans-serif' }}>
      <header className="border-b sticky top-0 z-50 backdrop-blur" style={{ borderColor: COLORS.border, background: 'rgba(10,10,10,0.9)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: COLORS.green }}></div>
            <h1 className="serif text-xl font-bold tracking-tight">
              <span style={{ color: COLORS.green }}>AI</span> Trade Desk
            </h1>
            <span className="mono text-[10px] px-2 py-0.5 rounded" style={{ background: COLORS.panelLight, color: COLORS.textDim }}>v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 mono text-xs" style={{ color: COLORS.textDim }}>
              <span>NET</span>
              <span className="font-bold" style={{ color: COLORS.text }}>RM {totalAssets.toFixed(2)}</span>
              <span style={{ color: positionPL >= 0 ? COLORS.green : COLORS.red }}>
                {positionPL >= 0 ? '▲' : '▼'} {positionPL >= 0 ? '+' : ''}{positionPL.toFixed(2)}
              </span>
            </div>
            <span className="mono text-xs hidden md:inline" style={{ color: COLORS.textDim }}>{userName}</span>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
              <Settings size={14} />
            </button>
            <button onClick={onSignOut} className="p-2 rounded" title="Sign out" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} autoRefreshMins={autoRefreshMins} onAutoRefreshChange={setAutoRefreshMins} />}

      <nav className="border-b sticky top-[57px] z-40" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto scrollbar">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-all border-b-2"
                style={{
                  color: active ? COLORS.text : COLORS.textDim,
                  borderColor: active ? COLORS.green : 'transparent',
                  background: active ? COLORS.panel : 'transparent'
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-b" style={{ borderColor: COLORS.border, background: 'rgba(245, 158, 11, 0.05)' }}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 text-[11px]" style={{ color: COLORS.amber }}>
          <AlertTriangle size={12} />
          <span>AI analysis is based on general knowledge — not real-time data. Verify with live charts. Not financial advice.</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Triggered alert banners */}
        {triggeredAlerts.map((a, i) => (
          <div key={i} className="mb-3 px-4 py-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(245,158,11,0.15)', border: `1px solid ${COLORS.amber}` }}>
            <span className="text-sm" style={{ color: COLORS.amber }}>
              🔔 <strong>{a.symbol}</strong> hit your target — now {a.currentPrice} ({a.direction === 'above' ? '▲' : '▼'} {a.targetPrice})
            </span>
            <button onClick={() => setTriggeredAlerts(prev => prev.filter((_, j) => j !== i))} style={{ color: COLORS.textDim }}><X size={14} /></button>
          </div>
        ))}

        {tab === 'dashboard' && <Dashboard holdings={holdings} cash={cash} totalAssets={totalAssets} positionPL={positionPL} portfolioValue={portfolioValue} setTab={setTab} snapshots={snapshots} lastRefreshed={lastRefreshed} usdMyr={usdMyr} />}
        {tab === 'watchlist' && (
          <Watchlist
            items={watchlist}
            onAdd={handleAddToWatchlist}
            onRemove={handleRemoveFromWatchlist}
            onAnalyze={handleAnalyzeFromWatchlist}
            onAddToPortfolio={handleAddHolding}
          />
        )}
        {tab === 'analyzer' && <Analyzer capital={capital} preFill={analyzerPreFill} onConsumePreFill={() => setAnalyzerPreFill(null)} />}
        {tab === 'portfolio' && (
          <Portfolio
            holdings={holdings}
            onAddHolding={handleAddHolding}
            onRemoveHolding={handleRemoveHolding}
            onUpdatePrice={handleUpdatePrice}
            onUpdatePriceBlur={handleUpdatePriceBlur}
            onReplacePortfolio={handleReplacePortfolio}
            cash={cash}
            onCashChange={handleCashChange}
            refreshPrices={refreshPrices}
            refreshing={refreshing}
            loading={portfolioLoading}
            alerts={alerts}
            onAddAlert={handleAddAlert}
            onRemoveAlert={handleRemoveAlert}
            lastRefreshed={lastRefreshed}
          />
        )}
        {tab === 'dividends' && <DividendTracker holdings={holdings} watchlist={watchlist} usdMyr={usdMyr} />}
        {tab === 'sizing' && <Sizing capital={capital} setCapital={setCapital} riskPct={riskPct} setRiskPct={setRiskPct} />}
        {tab === 'options' && <OptionsCalc />}
        {tab === 'chat' && <Chat holdings={holdings} capital={capital} cash={cash} userName={userName} />}
        {tab === 'journal' && <Journal trades={trades} onAddTrade={handleAddTrade} onRemoveTrade={handleRemoveTrade} />}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-6 text-[10px] text-center mono" style={{ color: COLORS.textDim }}>
        BUILT FOR {userName.toUpperCase()} · POWERED BY CLAUDE SONNET 4 · NOT FINANCIAL ADVICE
      </footer>

      {tab !== 'chat' && (
        <button
          onClick={() => setTab('chat')}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-transform hover:scale-105"
          style={{ background: COLORS.green, color: '#000', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)' }}
        >
          <MessageSquare size={18} />
          <span className="text-sm font-semibold hidden sm:inline">Ask AI</span>
        </button>
      )}
    </div>
  );
}

const AUTO_REFRESH_OPTIONS = [
  { value: 0,  label: 'Off' },
  { value: 1,  label: '1 min' },
  { value: 5,  label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

// ===== SETTINGS MODAL =====
function SettingsModal({ onClose, autoRefreshMins, onAutoRefreshChange }) {
  const [apiKey,        setApiKey]        = useState(localStorage.getItem('anthropic_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('claude_model') || DEFAULT_MODEL);
  const [localRefresh,  setLocalRefresh]  = useState(autoRefreshMins);
  const [saved,         setSaved]         = useState(false);

  const save = async () => {
    const trimmed = apiKey.trim();
    localStorage.setItem('anthropic_api_key', trimmed);
    localStorage.setItem('claude_model', selectedModel);
    onAutoRefreshChange(localRefresh);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await updateApiKey(user.id, trimmed);
    } catch {}
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-md rounded-lg p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="serif text-lg font-semibold">Settings</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-4">

          {/* API Key */}
          <div>
            <label className="text-xs mono uppercase" style={{ color: COLORS.textDim }}>Anthropic API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="block w-full mt-1 px-3 py-2 rounded mono text-sm outline-none"
              style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
            <p className="text-[11px] mt-1" style={{ color: COLORS.textDim }}>
              Get yours at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={{ color: COLORS.blue }}>console.anthropic.com</a> · Stored securely in Supabase
            </p>
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-xs mono uppercase" style={{ color: COLORS.textDim }}>Claude Model</label>
            <div className="flex flex-col gap-2 mt-2">
              {CLAUDE_MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                    background: selectedModel === m.id ? COLORS.panelLight : 'transparent',
                    border: `1px solid ${selectedModel === m.id ? m.color : COLORS.border}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                    <span style={{ color: COLORS.text, fontSize: '0.875rem', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
                    background: selectedModel === m.id ? m.color + '22' : 'transparent',
                    color: m.color, border: `1px solid ${m.color}44`,
                  }}>{m.badge}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-1" style={{ color: COLORS.textDim }}>
              Haiku 3.5 is ~10× cheaper than Sonnet · Recommended for daily use
            </p>
          </div>

          {/* Auto-refresh */}
          <div>
            <label className="text-xs mono uppercase" style={{ color: COLORS.textDim }}>Auto Price Refresh</label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AUTO_REFRESH_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setLocalRefresh(opt.value)}
                  className="px-3 py-1.5 rounded text-xs font-semibold"
                  style={{ background: localRefresh === opt.value ? COLORS.green : COLORS.panelLight, color: localRefresh === opt.value ? '#000' : COLORS.textDim, border: `1px solid ${localRefresh === opt.value ? COLORS.green : COLORS.border}` }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-1" style={{ color: COLORS.textDim }}>Automatically fetch live prices in the background</p>
          </div>

          <button onClick={save} className="w-full py-2 rounded font-semibold text-sm" style={{ background: COLORS.green, color: '#000' }}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== DASHBOARD =====
function Dashboard({ holdings, cash, totalAssets, positionPL, portfolioValue, setTab, snapshots = [], lastRefreshed, usdMyr = 4.40 }) {
  const [insight, setInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [error, setError] = useState('');

  const generateInsight = async () => {
    setLoadingInsight(true);
    setError('');
    try {
      const portfolioStr = holdings.map(h => `${h.symbol} (${h.qty} units @ avg ${h.avgCost})`).join(', ') || 'None';
      const prompt = `You are an experienced market analyst writing a "thought of the day" for a Malaysian retail trader.
Their portfolio: ${portfolioStr}. Total assets: RM${totalAssets.toFixed(2)}.
Write a short (3-4 sentences) sharp market insight focused on: market sentiment context, one observation about their holdings or sectors, and one actionable consideration. Be specific, avoid generic advice. No greetings. No disclaimers.`;
      const result = await callClaude(prompt, 400);
      setInsight(result);
    } catch (e) {
      setError(e.message);
    }
    setLoadingInsight(false);
  };

  const pieData = holdings.map(h => ({ name: h.symbol, value: h.qty * h.currentPrice }));
  if (cash > 0) pieData.push({ name: 'Cash', value: cash });

  const isUS = (sym) => !sym?.toUpperCase().endsWith('.KL');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Assets" value={`RM ${totalAssets.toFixed(2)}`} sub="MYR (all converted)" />
        <StatCard label="Market Value" value={`RM ${portfolioValue.toFixed(2)}`} sub={`${holdings.length} position${holdings.length !== 1 ? 's' : ''}`} />
        <StatCard label="Position P/L" value={`${positionPL >= 0 ? '+' : ''}RM ${Math.abs(positionPL).toFixed(2)}`} sub={portfolioValue > 0 && (portfolioValue - positionPL) > 0 ? `${positionPL >= 0 ? '+' : '-'}${Math.abs((positionPL / (portfolioValue - positionPL)) * 100).toFixed(2)}%` : '—'} color={positionPL >= 0 ? COLORS.green : COLORS.red} />
        <StatCard label="USD / MYR" value={`${usdMyr.toFixed(2)}`} sub="Live FX rate" color={COLORS.blue} />
      </div>

      <Panel>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: COLORS.amber }} />
            <h2 className="serif text-lg font-semibold">AI Daily Insight</h2>
          </div>
          <button onClick={generateInsight} disabled={loadingInsight} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded" style={{ color: COLORS.textDim, border: `1px solid ${COLORS.border}` }}>
            {loadingInsight ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Generate
          </button>
        </div>
        {error && <p className="text-xs mb-2" style={{ color: COLORS.red }}>{error}</p>}
        {insight ? (
          <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none"><ReactMarkdown>{insight}</ReactMarkdown></div>
        ) : (
          <p className="text-sm" style={{ color: COLORS.textDim }}>Click "Generate" for today's AI-powered market insight.</p>
        )}
      </Panel>

      {/* Performance Chart */}
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h3 className="serif text-base font-semibold">Portfolio Performance</h3>
          {lastRefreshed && <span className="text-[11px] mono" style={{ color: COLORS.textDim }}>Updated {lastRefreshed.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {snapshots.length < 2 ? (
          <p className="text-sm py-4 text-center" style={{ color: COLORS.textDim }}>Click "Live Prices" a few times to start tracking performance.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={snapshots} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.textDim }} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.textDim }} width={60} tickFormatter={v => `RM${v.toFixed(0)}`} />
              <Tooltip contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, fontSize: 12 }} formatter={(v) => [`RM ${v.toFixed(2)}`, 'Total Value']} />
              <Line type="monotone" dataKey="totalValue" stroke={COLORS.green} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid md:grid-cols-2 gap-3">
        <Panel>
          <h3 className="serif text-base font-semibold mb-3">Allocation</h3>
          {pieData.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.textDim }}>No holdings yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                      <span>{d.name}</span>
                    </div>
                    <span className="mono" style={{ color: COLORS.textDim }}>{((d.value / totalAssets) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="serif text-base font-semibold">Holdings</h3>
            <button onClick={() => setTab('portfolio')} className="text-[11px]" style={{ color: COLORS.green }}>Manage →</button>
          </div>
          {holdings.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.textDim }}>No positions.</p>
          ) : (
            <div className="space-y-2">
              {holdings.map((h, i) => {
                const fx   = isUS(h.symbol) ? usdMyr : 1;
                const val  = h.qty * h.currentPrice * fx;
                const cost = h.qty * h.avgCost * fx;
                const pl   = val - cost;
                const plPct = cost > 0 ? (pl / cost) * 100 : 0;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: COLORS.border }}>
                    <div>
                      <div className="font-semibold text-sm">{h.symbol}</div>
                      <div className="text-[11px] mono" style={{ color: COLORS.textDim }}>
                        {h.qty} @ {isUS(h.symbol) ? `$${h.avgCost}` : `RM${h.avgCost}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-sm">RM {val.toFixed(2)}</div>
                      {isUS(h.symbol) && (
                        <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>${(h.qty * h.currentPrice).toFixed(2)}</div>
                      )}
                      <div className="text-[11px] mono" style={{ color: pl >= 0 ? COLORS.green : COLORS.red }}>
                        {pl >= 0 ? '+' : ''}RM {Math.abs(pl).toFixed(2)} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <BenchmarkPanel positionPL={positionPL} portfolioValue={portfolioValue} />
    </div>
  );
}

// ===== BENCHMARK PANEL =====
function BenchmarkPanel({ positionPL, portfolioValue }) {
  const [bm, setBm] = useState(null); // null = loading

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/market/chart/VOO?range=1M`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/market/chart/SPY?range=1M`).then(r => r.ok ? r.json() : null),
    ]).then(([voo, spy]) => {
      const pct = (data) => {
        const c = data?.candles;
        if (!c || c.length < 2) return null;
        const start = c[0].close, end = c[c.length - 1].close;
        return Math.round(((end - start) / start) * 10000) / 100; // 2 dp
      };
      setBm({ voo: pct(voo), spy: pct(spy) });
    }).catch(() => setBm({ voo: null, spy: null }));
  }, []);

  // Portfolio unrealised return % (cost basis vs current value)
  const costBasis = portfolioValue - positionPL;
  const portPct = costBasis > 0 ? Math.round((positionPL / costBasis) * 10000) / 100 : null;

  const fmt = (v, pfx = '') =>
    v == null ? '—' : `${v >= 0 ? '+' : ''}${pfx}${Math.abs(v).toFixed(2)}%`;

  const col = (v) => v == null ? COLORS.textDim : v >= 0 ? COLORS.green : COLORS.red;

  return (
    <Panel>
      <h3 className="serif text-base font-semibold mb-3 flex items-center gap-2">
        <TrendingUp size={14} style={{ color: COLORS.blue }} /> vs Benchmark (1 Month)
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded" style={{ background: COLORS.panelLight }}>
          <div className="text-[10px] mono uppercase tracking-wider mb-1" style={{ color: COLORS.textDim }}>Your Portfolio</div>
          <div className="mono text-2xl font-bold" style={{ color: col(portPct) }}>{fmt(portPct)}</div>
          <div className="text-[10px] mono mt-1" style={{ color: COLORS.textDim }}>unrealised</div>
        </div>
        <div className="text-center p-3 rounded" style={{ background: COLORS.panelLight }}>
          <div className="text-[10px] mono uppercase tracking-wider mb-1" style={{ color: COLORS.textDim }}>VOO</div>
          <div className="mono text-2xl font-bold" style={{ color: col(bm?.voo ?? null) }}>
            {bm === null ? <Loader2 size={16} className="animate-spin mx-auto" /> : fmt(bm.voo)}
          </div>
          <div className="text-[10px] mono mt-1" style={{ color: COLORS.textDim }}>S&amp;P 500 ETF</div>
        </div>
        <div className="text-center p-3 rounded" style={{ background: COLORS.panelLight }}>
          <div className="text-[10px] mono uppercase tracking-wider mb-1" style={{ color: COLORS.textDim }}>SPY</div>
          <div className="mono text-2xl font-bold" style={{ color: col(bm?.spy ?? null) }}>
            {bm === null ? <Loader2 size={16} className="animate-spin mx-auto" /> : fmt(bm.spy)}
          </div>
          <div className="text-[10px] mono mt-1" style={{ color: COLORS.textDim }}>S&amp;P 500 ETF</div>
        </div>
      </div>
    </Panel>
  );
}

// ── Indicator helpers (pure functions, no React) ─────────────────────────
function calcMA(candles, period) {
  const out = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    out.push({ time: candles[i].time, value: Math.round(sum / period * 100) / 100 });
  }
  return out;
}

function calcRSI(candles, period = 14) {
  if (candles.length < period + 1) return [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  const out = [];
  for (let i = period; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    out.push({ time: candles[i].time, value: Math.round(rsi * 10) / 10 });
  }
  return out;
}

// ===== STOCK CHART =====
function StockChart({ symbol }) {
  const containerRef = useRef(null);
  const chartRef      = useRef(null);
  const candleRef     = useRef(null);
  const lineRef       = useRef(null);
  const volRef        = useRef(null);
  const markersRef      = useRef(null);
  const pendingMkRef    = useRef([]);
  const ma20Ref         = useRef(null);
  const ma50Ref         = useRef(null);
  const rsiContainerRef = useRef(null);
  const rsiChartRef     = useRef(null);
  const rsiSeriesRef    = useRef(null);
  const pendingRsiRef   = useRef([]);

  const [range,      setRange]      = useState('6M');
  const [chartType,  setChartType]  = useState('candle');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [divList,    setDivList]    = useState([]);
  const [indicators, setIndicators] = useState({ ma20: false, ma50: false, rsi: false });

  // ── Init chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let chart = null;
    let ro    = null;
    try {
      chart = createChart(containerRef.current, {
        layout:  { background: { color: '#141414' }, textColor: '#888' },
        grid:    { vertLines: { color: '#1e1e1e' }, horzLines: { color: '#1e1e1e' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#333' },
        timeScale: { borderColor: '#333', timeVisible: true, secondsVisible: false },
        autoSize: true,   // v5: let the container CSS control sizing
      });

      const cSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor:   '#26a69a', wickDownColor:   '#ef5350',
      });
      const lSeries = chart.addSeries(LineSeries, {
        color: '#00c896', lineWidth: 2,
      });
      try { lSeries.applyOptions({ visible: false }); } catch (_) {}

      // MA lines (hidden by default, toggled via indicator buttons)
      const ma20s = chart.addSeries(LineSeries, {
        color: '#f59e0b', lineWidth: 1, lastValueVisible: false, priceLineVisible: false,
      });
      try { ma20s.applyOptions({ visible: false }); } catch (_) {}
      const ma50s = chart.addSeries(LineSeries, {
        color: '#3b82f6', lineWidth: 1, lastValueVisible: false, priceLineVisible: false,
      });
      try { ma50s.applyOptions({ visible: false }); } catch (_) {}
      ma20Ref.current = ma20s;
      ma50Ref.current = ma50s;

      const vSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      try { chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } }); } catch (_) {}

      chartRef.current  = chart;
      candleRef.current = cSeries;
      lineRef.current   = lSeries;
      volRef.current    = vSeries;

      // Resize observer — keep for manual width sync on browsers where autoSize misses
      ro = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.offsetWidth });
        }
      });
      ro.observe(containerRef.current);
    } catch (e) {
      console.error('[StockChart] init failed:', e);
      setError('Chart failed to load: ' + (e?.message || String(e)));
    }

    return () => {
      ro?.disconnect();
      if (chart) { try { chart.remove(); } catch (_) {} }
      chartRef.current = null;
    };
  }, []);

  // ── RSI chart — created/destroyed when toggled ───────────────────────────
  useEffect(() => {
    if (!rsiContainerRef.current) return;
    if (!indicators.rsi) {
      if (rsiChartRef.current) {
        try { rsiChartRef.current.remove(); } catch (_) {}
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      }
      return;
    }
    if (rsiChartRef.current) return; // already initialised
    try {
      const rc = createChart(rsiContainerRef.current, {
        layout:  { background: { color: '#141414' }, textColor: '#888' },
        grid:    { vertLines: { color: '#1e1e1e' }, horzLines: { color: '#1e1e1e' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#333', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#333', visible: false },
        autoSize: true,
      });
      const rs = rc.addSeries(LineSeries, {
        color: '#00c896', lineWidth: 1, lastValueVisible: true,
        priceFormat: { precision: 1, minMove: 0.1 },
      });
      rs.createPriceLine({ price: 70, color: '#ef4444aa', lineWidth: 1, lineStyle: 2, title: 'OB' });
      rs.createPriceLine({ price: 30, color: '#10b981aa', lineWidth: 1, lineStyle: 2, title: 'OS' });
      rsiChartRef.current  = rc;
      rsiSeriesRef.current = rs;

      // Populate immediately if data already loaded
      if (pendingRsiRef.current.length > 0) {
        rs.setData(pendingRsiRef.current);
        rc.timeScale().fitContent();
      }

      // Sync scroll/zoom with main chart
      chartRef.current?.timeScale().subscribeVisibleLogicalRangeChange(r => {
        if (r) rsiChartRef.current?.timeScale().setVisibleLogicalRange(r);
      });
      rc.timeScale().subscribeVisibleLogicalRangeChange(r => {
        if (r) chartRef.current?.timeScale().setVisibleLogicalRange(r);
      });

      const ro = new ResizeObserver(() => {
        if (rsiContainerRef.current) rc.applyOptions({ width: rsiContainerRef.current.offsetWidth });
      });
      ro.observe(rsiContainerRef.current);
      return () => { ro.disconnect(); };
    } catch (e) { console.error('[RSI] init failed:', e); }
  }, [indicators.rsi]);

  // ── Fetch when symbol/range changes ──────────────────────────────────────
  useEffect(() => { if (symbol) loadChart(); }, [symbol, range]);

  const loadChart = async () => {
    if (!chartRef.current) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/market/chart/${encodeURIComponent(symbol)}?range=${range}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const validCandles = data.candles.filter(c => c.close != null);

      candleRef.current?.setData(validCandles.map(c => ({
        time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      lineRef.current?.setData(validCandles.map(c => ({ time: c.time, value: c.close })));
      volRef.current?.setData(validCandles.map(c => ({
        time: c.time, value: c.volume,
        color: c.close >= c.open ? '#26a69a44' : '#ef535044',
      })));
      chartRef.current?.timeScale().fitContent();

      // Moving averages (always calculated; visibility controlled by toggle)
      const ma20Data = calcMA(validCandles, 20);
      const ma50Data = calcMA(validCandles, 50);
      ma20Ref.current?.setData(ma20Data);
      ma50Ref.current?.setData(ma50Data);

      // RSI
      const rsiData = calcRSI(validCandles);
      pendingRsiRef.current = rsiData;
      if (rsiSeriesRef.current) {
        rsiSeriesRef.current.setData(rsiData);
        rsiChartRef.current?.timeScale().fitContent();
      }

      // Dividend markers
      const divs = data.dividends || [];
      setDivList(divs);
      pendingMkRef.current = divs.map(d => ({
        time: d.time, position: 'belowBar',
        color: '#f59e0b', shape: 'arrowUp',
        text: `÷${d.amount}`,
      }));
      applyMarkers();
    } catch (e) {
      setError(e.message || 'Failed to load chart');
    } finally {
      setLoading(false);
    }
  };

  const applyMarkers = () => {
    if (!candleRef.current) return;
    const markers = pendingMkRef.current;
    try {
      if (markersRef.current) markersRef.current.setMarkers(markers);
      else markersRef.current = createSeriesMarkers(candleRef.current, markers);
    } catch {
      try { markersRef.current = createSeriesMarkers(candleRef.current, markers); } catch {}
    }
  };

  const switchType = (type) => {
    setChartType(type);
    candleRef.current?.applyOptions({ visible: type === 'candle' });
    lineRef.current?.applyOptions({ visible: type === 'line' });
  };

  const toggleIndicator = (name) => {
    setIndicators(prev => {
      const next = { ...prev, [name]: !prev[name] };
      try {
        if (name === 'ma20') ma20Ref.current?.applyOptions({ visible: next.ma20 });
        if (name === 'ma50') ma50Ref.current?.applyOptions({ visible: next.ma50 });
      } catch (_) {}
      return next;
    });
  };

  return (
    <Panel>
      {/* Controls row 1: type + range */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex gap-1">
          {[['candle','🕯 Candle'],['line','📈 Line']].map(([t, label]) => (
            <button key={t} onClick={() => switchType(t)}
              className="px-3 py-1 rounded text-xs"
              style={{ background: chartType === t ? COLORS.green : COLORS.panelLight, color: chartType === t ? '#000' : COLORS.textDim, border: `1px solid ${COLORS.border}` }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {['1W','1M','3M','6M','1Y','5Y'].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-2 py-1 rounded text-xs font-mono"
              style={{ background: range === r ? COLORS.green : COLORS.panelLight, color: range === r ? '#000' : COLORS.textDim, border: `1px solid ${COLORS.border}` }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Controls row 2: indicator toggles */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[['ma20','MA20','#f59e0b'],['ma50','MA50','#3b82f6'],['rsi','RSI','#00c896']].map(([key, label, color]) => (
          <button key={key} onClick={() => toggleIndicator(key)}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{
              background: indicators[key] ? color + '22' : COLORS.panelLight,
              color:      indicators[key] ? color : COLORS.textDim,
              border:    `1px solid ${indicators[key] ? color : COLORS.border}`,
            }}>
            {label}
          </button>
        ))}
        {(indicators.ma20 || indicators.ma50) && (
          <span className="text-[10px] self-center ml-1" style={{ color: COLORS.textDim }}>
            {indicators.ma20 && <span style={{ color: '#f59e0b' }}>■ MA20 </span>}
            {indicators.ma50 && <span style={{ color: '#3b82f6' }}>■ MA50</span>}
          </span>
        )}
      </div>

      {/* Main chart container */}
      <div style={{ position: 'relative', height: '320px' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: '#14141499', zIndex: 10 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: COLORS.green }} />
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '320px' }} />
      </div>

      {/* RSI panel — shown only when RSI toggled on */}
      <div style={{ display: indicators.rsi ? 'block' : 'none', marginTop: '2px' }}>
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[10px] mono font-semibold" style={{ color: '#00c896' }}>RSI (14)</span>
          <span className="text-[10px] mono" style={{ color: COLORS.textDim }}>
            <span style={{ color: '#ef4444' }}>— 70 overbought</span>
            {' · '}
            <span style={{ color: '#10b981' }}>— 30 oversold</span>
          </span>
        </div>
        <div ref={rsiContainerRef} style={{ width: '100%', height: '90px' }} />
      </div>

      {error && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: COLORS.red }}>⚠ {error}</p>}

      {/* Dividend chips */}
      {divList.length > 0 && (
        <div className="mt-3">
          <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: COLORS.textDim }}>
            💰 Dividends (last {Math.min(divList.length, 6)})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {divList.slice(-6).map((d, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b33' }}>
                {new Date(d.time * 1000).toLocaleDateString('en-MY', { day:'2-digit', month:'short', year:'2-digit' })} · {d.amount}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ===== NEWS PANEL =====
function NewsPanel({ symbol }) {
  const [news,    setNews]    = useState(null);   // null = loading
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setNews(null);
    setLoading(true);
    fetch(`${API_BASE}/api/market/news/${encodeURIComponent(symbol)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setNews(Array.isArray(data) ? data : []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  function relTime(ts) {
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000) - Number(ts);
    if (diff < 3600)  return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  if (loading || news === null) {
    return (
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Newspaper size={14} style={{ color: COLORS.textDim }} />
          <h3 className="serif text-base font-semibold">Latest News</h3>
        </div>
        <div className="flex items-center gap-2 py-3 justify-center" style={{ color: COLORS.textDim }}>
          <Loader2 size={13} className="animate-spin" />
          <span className="text-xs">Loading headlines...</span>
        </div>
      </Panel>
    );
  }

  if (!news.length) return null;

  return (
    <Panel>
      <h3 className="serif text-base font-semibold mb-3 flex items-center gap-2">
        <Newspaper size={14} style={{ color: COLORS.textDim }} /> Latest News
      </h3>
      <div className="divide-y" style={{ borderColor: COLORS.border }}>
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2.5 group"
          >
            <div className="text-sm leading-snug group-hover:underline" style={{ color: COLORS.text }}>
              {item.title}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] mono" style={{ color: COLORS.textDim }}>{item.publisher}</span>
              {item.time > 0 && (
                <>
                  <span style={{ color: COLORS.border }}>·</span>
                  <span className="text-[11px] mono" style={{ color: COLORS.textDim }}>{relTime(item.time)}</span>
                </>
              )}
            </div>
          </a>
        ))}
      </div>
    </Panel>
  );
}

// ===== ANALYZER =====
function Analyzer({ capital, preFill, onConsumePreFill }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [fallbackText, setFallbackText] = useState('');
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Auto-analyze when launched from Watchlist
  useEffect(() => {
    if (preFill?.symbol && !analyzing && !analysis) {
      setQuery(preFill.symbol);
      analyzeticker(preFill.symbol, preFill.name || '', '');
      onConsumePreFill?.();
    }
  }, [preFill?.symbol]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true); setError(''); setAnalysis(null); setFallbackText(''); setSuggestions([]); setSearched(false);
    const q = query.trim().toUpperCase();
    try {
      const prompt = `User is searching for a stock or ETF. Query: "${q}"

Return ONLY a valid JSON object.

If exact recognized ticker: {"matchType":"exact","ticker":"X","name":"Full Name","market":"US or Bursa Malaysia"}
If partial/misspelled: {"matchType":"suggestions","results":[{"ticker":"X","name":"Y","market":"Z"}]} (up to 5)
If unknown: {"matchType":"none","message":"No matches"}

Match Malaysian (Bursa) and US tickers. Be helpful with keywords like "tech etf", "bank malaysia".`;

      const result = await callClaude(prompt, 800);
      const parsed = parseJSON(result);
      if (!parsed) { setError('Search failed. Try again.'); setSearching(false); return; }
      setSearched(true);
      if (parsed.matchType === 'exact') {
        await analyzeticker(parsed.ticker, parsed.name, parsed.market);
      } else if (parsed.matchType === 'suggestions' && parsed.results?.length > 0) {
        setSuggestions(parsed.results);
      } else {
        setError(parsed.message || 'No matches found.');
      }
    } catch (e) { setError(e.message); }
    setSearching(false);
  };

  const analyzeticker = async (tk, name, market) => {
    setAnalyzing(true); setError(''); setAnalysis(null); setFallbackText(''); setSuggestions([]);
    try {
      // Fetch live price from backend first (avoids stale AI training data)
      const liveData = await fetchLivePrice(tk);
      const livePriceLine = liveData
        ? `LIVE MARKET DATA (fetched now): price=${liveData.price} ${liveData.currency}, change=${liveData.change} (${liveData.changePct}%). Use this exact price for all analysis — do NOT use your training data prices.`
        : `Note: live price unavailable — use your best known price estimate.`;

      const prompt = `Analyze "${tk}" (${name || ''}, ${market || ''}) as a professional trading analyst.

${livePriceLine}

Respond with ONLY a single valid JSON object. No markdown. No text outside JSON.

{
  "ticker": "${tk}",
  "name": "full name",
  "market": "market",
  "sector": "sector",
  "currentPrice": ${liveData?.price || 'null'},
  "currency": "${liveData?.currency || 'USD'}",
  "verdict": "BUY|SELL|HOLD",
  "confidence": 7,
  "summary": "two sentences referencing the current price",
  "technical": {"trend":"...","momentum":"...","support":"price level","resistance":"price level"},
  "fundamental": "two sentences",
  "risks": ["r1","r2","r3"],
  "tradePlan": {"entryZone":"price range","stopLoss":"price","target":"price","positionSize":"RM amount for ${capital} at 2% risk","rationale":"one sentence"}
}`;
      const result = await callClaude(prompt, 2000);
      const parsed = parseJSON(result);
      if (parsed) setAnalysis(parsed);
      else {
        const textPrompt = `Give structured analysis of ${tk} with sections: Verdict, Overview, Technical, Fundamental, Risks, Trade Plan (entry/stop/target/RM${capital}@2% size/rationale).`;
        setFallbackText(await callClaude(textPrompt, 1500));
      }
    } catch (e) { setError(e.message); }
    setAnalyzing(false);
  };

  const reset = () => { setQuery(''); setSuggestions([]); setAnalysis(null); setFallbackText(''); setError(''); setSearched(false); };
  const verdictColor = analysis?.verdict === 'BUY' ? COLORS.green : analysis?.verdict === 'SELL' ? COLORS.red : COLORS.amber;
  const loading = searching || analyzing;

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="serif text-lg font-semibold mb-3">Stock / ETF Search</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search: VOO, apple, tech etf, sun, bank..."
            className="flex-1 px-3 py-2 rounded mono text-sm outline-none"
            style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            disabled={loading}
          />
          <button onClick={search} disabled={loading || !query.trim()} className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 disabled:opacity-50" style={{ background: COLORS.green, color: '#000' }}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {searching ? 'Searching' : 'Search'}
          </button>
          {(analysis || fallbackText || suggestions.length > 0) && (
            <button onClick={reset} className="px-3 py-2 rounded text-sm" style={{ background: COLORS.panelLight, color: COLORS.textDim, border: `1px solid ${COLORS.border}` }}><X size={14} /></button>
          )}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: COLORS.textDim }}>💡 Examples: <span className="mono">VOO</span> · <span className="mono">apple</span> · <span className="mono">tech etf</span> · <span className="mono">malaysia bank</span></p>
        {error && <p className="mt-2 text-xs" style={{ color: COLORS.red }}>{error}</p>}
      </Panel>

      {suggestions.length > 0 && !analyzing && !analysis && (
        <Panel>
          <p className="text-xs mb-3" style={{ color: COLORS.textDim }}>No exact match. Did you mean:</p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => analyzeticker(s.ticker, s.name, s.market)} className="w-full flex items-center justify-between p-3 rounded text-left" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
                <div>
                  <div className="font-bold mono text-sm" style={{ color: COLORS.green }}>{s.ticker}</div>
                  <div className="text-xs mt-0.5">{s.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] mono uppercase" style={{ color: COLORS.textDim }}>{s.market}</div>
                  <div className="text-[11px] mt-1" style={{ color: COLORS.green }}>Analyze →</div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {analyzing && <Panel><div className="flex items-center justify-center gap-3 py-8"><Loader2 className="animate-spin" style={{ color: COLORS.green }} /><span className="text-sm" style={{ color: COLORS.textDim }}>Running analysis...</span></div></Panel>}

      {analysis && (
        <>
          <Panel>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="mono text-xs" style={{ color: COLORS.textDim }}>{analysis.market} · {analysis.sector}</div>
                <div className="serif text-2xl font-bold mt-1">{analysis.ticker} <span className="text-base font-normal" style={{ color: COLORS.textDim }}>{analysis.name}</span></div>
                {analysis.currentPrice && (
                  <div className="mono text-sm mt-1 font-semibold" style={{ color: COLORS.green }}>
                    {analysis.currency} {analysis.currentPrice} <span className="text-[10px] font-normal" style={{ color: COLORS.textDim }}>· live</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="serif text-4xl font-bold" style={{ color: verdictColor }}>{analysis.verdict}</div>
                <div className="mono text-xs" style={{ color: COLORS.textDim }}>Confidence: {analysis.confidence}/10</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{analysis.summary}</p>
          </Panel>
          <StockChart symbol={analysis.ticker} />
          <NewsPanel symbol={analysis.ticker} />
          <div className="grid md:grid-cols-2 gap-3">
            <Panel>
              <h3 className="serif text-base font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} /> Technical</h3>
              <div className="space-y-2 text-sm">
                <Row label="Trend" value={analysis.technical.trend} />
                <Row label="Momentum" value={analysis.technical.momentum} />
                <Row label="Support" value={analysis.technical.support} mono />
                <Row label="Resistance" value={analysis.technical.resistance} mono />
              </div>
            </Panel>
            <Panel>
              <h3 className="serif text-base font-semibold mb-3 flex items-center gap-2"><Shield size={14} /> Fundamental</h3>
              <p className="text-sm leading-relaxed">{analysis.fundamental}</p>
            </Panel>
          </div>
          <Panel>
            <h3 className="serif text-base font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.amber }}><AlertTriangle size={14} /> Risks</h3>
            <ul className="space-y-2">
              {analysis.risks.map((r, i) => (<li key={i} className="flex gap-2 text-sm"><span style={{ color: COLORS.amber }}>—</span><span>{r}</span></li>))}
            </ul>
          </Panel>
          <Panel accent={COLORS.green}>
            <h3 className="serif text-base font-semibold mb-3 flex items-center gap-2"><Target size={14} style={{ color: COLORS.green }} /> AI Trade Plan</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <PlanItem label="Entry Zone" value={analysis.tradePlan.entryZone} />
              <PlanItem label="Stop Loss" value={analysis.tradePlan.stopLoss} color={COLORS.red} />
              <PlanItem label="Target" value={analysis.tradePlan.target} color={COLORS.green} />
              <PlanItem label="Position Size" value={analysis.tradePlan.positionSize} />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: COLORS.textDim }}>{analysis.tradePlan.rationale}</p>
          </Panel>
        </>
      )}

      {fallbackText && !analysis && (
        <>
          <StockChart symbol={query.toUpperCase().trim()} />
          <NewsPanel symbol={query.toUpperCase().trim()} />
          <Panel accent={COLORS.amber}>
            <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} style={{ color: COLORS.amber }} /><h3 className="serif text-base font-semibold">Analysis (Text Mode)</h3></div>
            <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none"><ReactMarkdown>{fallbackText}</ReactMarkdown></div>
          </Panel>
        </>
      )}

      {!searched && !loading && (
        <Panel>
          <div className="text-center py-8" style={{ color: COLORS.textDim }}>
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Search any stock, ETF, or keyword</p>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {['VOO', 'SPY', 'AAPL', '5176.KL', 'tech etf', 'malaysia bank'].map(ex => (
                <button key={ex} onClick={() => { setQuery(ex); setTimeout(() => search(), 50); }} className="text-[11px] px-2 py-1 rounded mono" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}>{ex}</button>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: COLORS.green }}>💬 For free-form questions, use the AI Chat tab</p>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ===== WATCHLIST =====
function Watchlist({ items, onAdd, onRemove, onAnalyze, onAddToPortfolio }) {
  const [prices,          setPrices]          = useState({});
  const [loadingPrices,   setLoadingPrices]   = useState(false);
  const [scans,           setScans]           = useState({});
  const [addingSymbol,    setAddingSymbol]     = useState(null);
  const [portfolioForm,   setPortfolioForm]   = useState({ qty: '', avgCost: '' });
  const [symbolQuery,     setSymbolQuery]     = useState('');
  const [symbolResults,   setSymbolResults]   = useState([]);
  const [symbolSearching, setSymbolSearching] = useState(false);
  const [showSearch,      setShowSearch]      = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => { if (items.length > 0) fetchPrices(); }, [items.length]);

  const fetchPrices = async () => {
    setLoadingPrices(true);
    const entries = await Promise.all(items.map(async i => [i.symbol, await fetchLivePrice(i.symbol)]));
    const map = {};
    entries.forEach(([sym, data]) => { if (data && !data.error) map[sym] = data; });
    setPrices(map);
    setLoadingPrices(false);
  };

  const quickScan = async (symbol, name) => {
    setScans(prev => ({ ...prev, [symbol]: { loading: true } }));
    try {
      const p = prices[symbol];
      const priceStr = p ? `Current price: ${p.price} ${p.currency}, change: ${p.changePct}%` : '';
      const result = await callClaude(
        `Quick BUY/HOLD/SELL verdict for ${symbol} (${name}). ${priceStr}. Return ONLY JSON: {"verdict":"BUY","confidence":7,"reason":"one sentence"}`, 200
      );
      const parsed = parseJSON(result);
      setScans(prev => ({ ...prev, [symbol]: parsed || { verdict: '?', confidence: 5, reason: '' } }));
    } catch (e) {
      setScans(prev => ({ ...prev, [symbol]: { verdict: 'ERR' } }));
    }
  };

  const handleSymbolInput = (val) => {
    setSymbolQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSymbolResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSymbolSearching(true);
      setSymbolResults(await searchSymbols(val));
      setSymbolSearching(false);
    }, 400);
  };

  const selectAndAdd = (r) => {
    onAdd({ symbol: r.symbol, name: r.name, exchange: r.exchange });
    setSymbolQuery(''); setSymbolResults([]); setShowSearch(false);
  };

  const verdictStyle = (v) => ({
    BUY:  { bg: COLORS.green + '22', color: COLORS.green,  border: COLORS.green + '44' },
    SELL: { bg: COLORS.red   + '22', color: COLORS.red,    border: COLORS.red   + '44' },
    HOLD: { bg: COLORS.amber + '22', color: COLORS.amber,  border: COLORS.amber + '44' },
  }[v] || { bg: COLORS.panelLight, color: COLORS.textDim, border: COLORS.border });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h2 className="serif text-lg font-semibold flex items-center gap-2">
            <Eye size={16} style={{ color: COLORS.green }} /> Watchlist
            {items.length > 0 && <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: COLORS.panelLight, color: COLORS.textDim }}>{items.length}</span>}
          </h2>
          <div className="flex gap-2">
            <button onClick={fetchPrices} disabled={loadingPrices || !items.length}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded disabled:opacity-40"
              style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}>
              {loadingPrices ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => setShowSearch(s => !s)}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded"
              style={{ background: COLORS.green, color: '#000' }}>
              <Plus size={14} /> Watch
            </button>
          </div>
        </div>

        {/* Symbol search */}
        {showSearch && (
          <div className="mb-4 relative">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded mono text-sm"
              style={{ background: COLORS.bg, border: `1px solid ${symbolResults.length ? COLORS.green : COLORS.border}` }}>
              {symbolSearching ? <Loader2 size={12} className="animate-spin" style={{ color: COLORS.textDim }} /> : <Search size={12} style={{ color: COLORS.textDim }} />}
              <input
                placeholder="Search symbol or name to watch…"
                value={symbolQuery}
                onChange={e => handleSymbolInput(e.target.value)}
                onBlur={() => setTimeout(() => setSymbolResults([]), 150)}
                className="flex-1 outline-none bg-transparent mono text-sm" style={{ color: COLORS.text }}
                autoFocus
              />
              {symbolQuery && <button onMouseDown={e => { e.preventDefault(); setSymbolQuery(''); setSymbolResults([]); }}><X size={12} style={{ color: COLORS.textDim }} /></button>}
            </div>
            {symbolResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded overflow-hidden shadow-xl" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
                {symbolResults.map((r, i) => (
                  <button key={i} onMouseDown={e => { e.preventDefault(); selectAndAdd(r); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm"
                    style={{ background: i % 2 === 0 ? COLORS.panelLight : COLORS.panel, borderBottom: `1px solid ${COLORS.border}` }}>
                    <div>
                      <span className="mono font-bold" style={{ color: COLORS.green }}>{r.symbol}</span>
                      <span className="ml-2 text-xs" style={{ color: COLORS.text }}>{r.name}</span>
                    </div>
                    <span className="text-[10px] mono" style={{ color: COLORS.textDim }}>{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List */}
        {items.length === 0 ? (
          <div className="py-10 text-center" style={{ color: COLORS.textDim }}>
            <Eye size={28} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No stocks on watchlist.</p>
            <p className="text-xs mt-1">Click "+ Watch" to add stocks you're tracking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const price   = prices[item.symbol];
              const scan    = scans[item.symbol];
              const isAdding = addingSymbol === item.symbol;
              const vs      = scan && !scan.loading && scan.verdict ? verdictStyle(scan.verdict) : null;

              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded"
                    style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
                    {/* Left: symbol + name */}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold mono text-sm" style={{ color: COLORS.green }}>{item.symbol}</span>
                      <span className="text-xs ml-2 truncate" style={{ color: COLORS.text }}>{item.name}</span>
                      {item.exchange && <span className="text-[10px] mono ml-2" style={{ color: COLORS.textDim }}>{item.exchange}</span>}
                    </div>

                    {/* Right: price + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Price */}
                      {price ? (
                        <div className="text-right mr-1">
                          <div className="mono text-sm font-semibold">{price.currency} {price.price}</div>
                          <div className="mono text-[11px]" style={{ color: price.changePct >= 0 ? COLORS.green : COLORS.red }}>
                            {price.changePct >= 0 ? '+' : ''}{price.changePct}%
                          </div>
                        </div>
                      ) : loadingPrices ? (
                        <Loader2 size={13} className="animate-spin mr-1" style={{ color: COLORS.textDim }} />
                      ) : null}

                      {/* AI verdict badge */}
                      {vs && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded mono font-bold"
                          style={{ background: vs.bg, color: vs.color, border: `1px solid ${vs.border}` }}>
                          {scan.verdict}
                        </span>
                      )}

                      {/* Scan button (show if no scan yet) */}
                      {!scan && (
                        <button onClick={() => quickScan(item.symbol, item.name)}
                          className="text-[11px] px-2 py-1 rounded"
                          style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.textDim }}>
                          Scan
                        </button>
                      )}
                      {scan?.loading && <Loader2 size={13} className="animate-spin" style={{ color: COLORS.textDim }} />}

                      {/* Analyze */}
                      <button onClick={() => onAnalyze(item.symbol, item.name)}
                        className="text-[11px] px-2 py-1 rounded"
                        style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.blue}44`, color: COLORS.blue }}>
                        Analyze →
                      </button>

                      {/* + Portfolio */}
                      <button onClick={() => { setAddingSymbol(isAdding ? null : item.symbol); setPortfolioForm({ qty: '', avgCost: String(price?.price || '') }); }}
                        className="text-[11px] px-2 py-1 rounded"
                        style={{ background: isAdding ? COLORS.green : COLORS.panelLight, color: isAdding ? '#000' : COLORS.green, border: `1px solid ${COLORS.green}55` }}>
                        + Port
                      </button>

                      <button onClick={() => onRemove(item.id)} className="opacity-40 hover:opacity-100 ml-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Inline scan reason */}
                  {scan && !scan.loading && scan.reason && (
                    <div className="px-3 py-1.5 text-[11px] rounded-b -mt-1" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: 'none', color: COLORS.textDim }}>
                      {scan.reason}
                    </div>
                  )}

                  {/* Inline add to portfolio form */}
                  {isAdding && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-b -mt-1 flex-wrap"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.green}44`, borderTop: 'none' }}>
                      <span className="text-xs mono" style={{ color: COLORS.textDim }}>Qty:</span>
                      <input type="number" placeholder="300" value={portfolioForm.qty}
                        onChange={e => setPortfolioForm(f => ({ ...f, qty: e.target.value }))}
                        className="w-20 px-2 py-1 rounded mono text-sm"
                        style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
                      <span className="text-xs mono" style={{ color: COLORS.textDim }}>Avg Cost:</span>
                      <input type="number" step="0.01" placeholder="2.16" value={portfolioForm.avgCost}
                        onChange={e => setPortfolioForm(f => ({ ...f, avgCost: e.target.value }))}
                        className="w-24 px-2 py-1 rounded mono text-sm"
                        style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
                      <button
                        disabled={!portfolioForm.qty || !portfolioForm.avgCost}
                        onClick={() => {
                          onAddToPortfolio({ symbol: item.symbol, qty: parseFloat(portfolioForm.qty), avgCost: parseFloat(portfolioForm.avgCost), currentPrice: price?.price || parseFloat(portfolioForm.avgCost), market: item.exchange?.toLowerCase().includes('kuala') ? 'MYR' : 'USD' });
                          setAddingSymbol(null);
                        }}
                        className="px-3 py-1 rounded text-sm font-semibold disabled:opacity-40"
                        style={{ background: COLORS.green, color: '#000' }}>
                        Confirm
                      </button>
                      <button onClick={() => setAddingSymbol(null)} className="text-sm" style={{ color: COLORS.textDim }}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ===== PORTFOLIO =====
function Portfolio({ holdings, onAddHolding, onRemoveHolding, onUpdatePrice, onUpdatePriceBlur, onReplacePortfolio, cash, onCashChange, refreshPrices, refreshing, loading, alerts, onAddAlert, onRemoveAlert, lastRefreshed }) {
  const [showAdd, setShowAdd]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState({ symbol: '', qty: '', avgCost: '', currentPrice: '', market: 'MYR' });
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState([]);
  const [symbolSearching, setSymbolSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [csvError, setCsvError]       = useState('');
  const [csvPreview, setCsvPreview]   = useState(null);   // parsed rows before confirm
  const [importing, setImporting]     = useState(false);
  const searchTimeout = useRef(null);
  const fileRef       = useRef(null);

  // ── Symbol search ──────────────────────────────────────────────────────────
  const handleSymbolInput = (val) => {
    setSymbolQuery(val);
    setForm(f => ({ ...f, symbol: val }));
    setShowDropdown(true);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 1) { setSymbolResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSymbolSearching(true);
      const results = await searchSymbols(val);
      setSymbolResults(results);
      setSymbolSearching(false);
    }, 400);
  };

  const selectSymbol = async (result) => {
    setSymbolQuery(result.symbol);
    setForm(f => ({ ...f, symbol: result.symbol }));
    setSymbolResults([]);
    setShowDropdown(false);
    const live = await fetchLivePrice(result.symbol);
    if (live?.price) setForm(f => ({ ...f, symbol: result.symbol, currentPrice: String(live.price) }));
  };

  // ── Add holding ────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.symbol || !form.qty || !form.avgCost) return;
    setSaving(true);
    await onAddHolding({
      symbol:       form.symbol.toUpperCase(),
      qty:          parseFloat(form.qty),
      avgCost:      parseFloat(form.avgCost),
      currentPrice: parseFloat(form.currentPrice) || parseFloat(form.avgCost),
      market:       form.market,
    });
    setForm({ symbol: '', qty: '', avgCost: '', currentPrice: '', market: 'MYR' });
    setSymbolQuery('');
    setSymbolResults([]);
    setShowAdd(false);
    setSaving(false);
  };

  // ── CSV import ─────────────────────────────────────────────────────────────
  const parseMoomooCSV = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV appears empty');

    // Find header row (contains Symbol or Ticker)
    let headerIdx = lines.findIndex(l => /symbol|ticker/i.test(l));
    if (headerIdx === -1) headerIdx = 0;

    const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Column index helpers
    const col = (...names) => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n));
        if (i !== -1) return i;
      }
      return -1;
    };

    const symIdx  = col('symbol', 'ticker', 'code');
    const qtyIdx  = col('qty', 'quantity', 'shares', 'volume');
    const costIdx = col('avgcost', 'averagecost', 'cost', 'avgprice');
    const priceIdx = col('latestprice', 'currentprice', 'price', 'lastprice', 'closingprice');

    if (symIdx === -1 || qtyIdx === -1 || costIdx === -1)
      throw new Error('Could not find Symbol / Qty / Avg Cost columns. Please check your CSV format.');

    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
      const symbol = cells[symIdx]?.toUpperCase();
      const qty    = parseFloat(cells[qtyIdx]);
      const cost   = parseFloat(cells[costIdx]?.replace(/[^0-9.-]/g, ''));
      const price  = priceIdx !== -1 ? parseFloat(cells[priceIdx]?.replace(/[^0-9.-]/g, '')) : null;
      if (!symbol || isNaN(qty) || isNaN(cost) || qty <= 0) continue;
      rows.push({ symbol, qty, avgCost: cost, currentPrice: price || cost, market: 'MYR' });
    }
    if (rows.length === 0) throw new Error('No valid rows found in CSV');
    return rows;
  };

  const handleFileChange = (e) => {
    setCsvError('');
    setCsvPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseMoomooCSV(ev.target.result);
        setCsvPreview(rows);
      } catch (err) {
        setCsvError(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!csvPreview) return;
    setImporting(true);
    setCsvError('');
    try {
      await onReplacePortfolio(csvPreview);
      setCsvPreview(null);
    } catch (e) {
      setCsvError('Import failed: ' + e.message);
    }
    setImporting(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h2 className="serif text-lg font-semibold">Portfolio Manager</h2>
          <div className="flex items-center gap-2">
            {/* Print / export */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded"
              style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.textDim }}
              title="Print / save as PDF"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* CSV import */}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded"
              style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.textDim }}
              title="Import from MOOMOO CSV export"
            >
              <Plus size={14} /> Import CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

            {/* Live prices */}
            <button
              onClick={refreshPrices}
              disabled={refreshing || holdings.length === 0}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded disabled:opacity-40"
              style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Live Prices'}</span>
            </button>

            {/* Add manually */}
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded" style={{ background: COLORS.green, color: '#000' }}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* CSV preview / confirm */}
        {csvPreview && (
          <div className="mb-4 p-3 rounded" style={{ background: 'rgba(59,130,246,0.08)', border: `1px solid ${COLORS.blue}` }}>
            <p className="text-sm font-semibold mb-2" style={{ color: COLORS.blue }}>
              Found {csvPreview.length} holding{csvPreview.length !== 1 ? 's' : ''} — this will replace your current portfolio.
            </p>
            <div className="text-xs mono space-y-0.5 mb-3 max-h-32 overflow-y-auto">
              {csvPreview.map((r, i) => (
                <div key={i} style={{ color: COLORS.textDim }}>
                  {r.symbol} · qty {r.qty} · cost {r.avgCost}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmImport} disabled={importing} className="px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-50" style={{ background: COLORS.blue, color: '#fff' }}>
                {importing ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                Confirm Import
              </button>
              <button onClick={() => setCsvPreview(null)} className="px-3 py-1.5 rounded text-sm" style={{ background: COLORS.panelLight, color: COLORS.textDim, border: `1px solid ${COLORS.border}` }}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {csvError && <p className="text-xs mb-3" style={{ color: COLORS.red }}>{csvError}</p>}

        {/* Cash */}
        <div className="mb-4">
          <label className="text-xs mono" style={{ color: COLORS.textDim }}>CASH (RM)</label>
          <input type="number" value={cash} onChange={e => onCashChange(e.target.value)} className="block w-32 mt-1 px-2 py-1 rounded mono text-sm" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-4 p-3 rounded space-y-2" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
            <div className="relative">
              <div className="flex items-center gap-1 px-2 py-1.5 rounded mono text-sm" style={{ background: COLORS.bg, border: `1px solid ${showDropdown && symbolResults.length > 0 ? COLORS.green : COLORS.border}` }}>
                {symbolSearching
                  ? <Loader2 size={12} className="animate-spin" style={{ color: COLORS.textDim, flexShrink: 0 }} />
                  : <Search size={12} style={{ color: COLORS.textDim, flexShrink: 0 }} />}
                <input
                  placeholder="Search symbol or name — e.g. SUNREIT, apple, VOO"
                  value={symbolQuery}
                  onChange={e => handleSymbolInput(e.target.value)}
                  onFocus={() => symbolResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className="flex-1 outline-none bg-transparent mono text-sm"
                  style={{ color: COLORS.text }}
                />
                {symbolQuery && (
                  <button onMouseDown={e => { e.preventDefault(); setSymbolQuery(''); setForm(f => ({ ...f, symbol: '', currentPrice: '' })); setSymbolResults([]); }}>
                    <X size={12} style={{ color: COLORS.textDim }} />
                  </button>
                )}
              </div>
              {showDropdown && symbolResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded overflow-hidden shadow-xl" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
                  {symbolResults.map((r, i) => (
                    <button key={i} onMouseDown={e => { e.preventDefault(); selectSymbol(r); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm"
                      style={{ background: i % 2 === 0 ? COLORS.panelLight : COLORS.panel, borderBottom: `1px solid ${COLORS.border}` }}
                    >
                      <div>
                        <span className="mono font-bold" style={{ color: COLORS.green }}>{r.symbol}</span>
                        <span className="ml-2 text-xs" style={{ color: COLORS.text }}>{r.name}</span>
                      </div>
                      <span className="text-[10px] mono ml-2 whitespace-nowrap" style={{ color: COLORS.textDim }}>{r.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input placeholder="Qty" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <input placeholder="Avg Cost" type="number" step="0.01" value={form.avgCost} onChange={e => setForm({ ...form, avgCost: e.target.value })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <input placeholder="Current Price" type="number" step="0.01" value={form.currentPrice} onChange={e => setForm({ ...form, currentPrice: e.target.value })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <button onClick={handleAdd} disabled={!form.symbol || !form.qty || !form.avgCost || saving} className="px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1" style={{ background: COLORS.green, color: '#000' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : null} Save
              </button>
            </div>
          </div>
        )}

        {/* Holdings table */}
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2" style={{ color: COLORS.textDim }}>
            <Loader2 size={18} className="animate-spin" /> Loading portfolio…
          </div>
        ) : holdings.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: COLORS.textDim }}>No holdings. Add manually or import from MOOMOO CSV.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] mono uppercase" style={{ color: COLORS.textDim, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="py-2">Symbol</th><th>Qty</th><th>Cost</th><th>Current</th><th>MV</th><th>P/L</th><th></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const mv    = h.qty * h.currentPrice;
                  const pl    = (h.currentPrice - h.avgCost) * h.qty;
                  const plPct = ((h.currentPrice - h.avgCost) / h.avgCost) * 100;
                  return (
                    <tr key={h.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td className="py-3 font-semibold">{h.symbol}</td>
                      <td className="mono">{h.qty}</td>
                      <td className="mono">{h.avgCost.toFixed(2)}</td>
                      <td>
                        <input
                          type="number" step="0.01" value={h.currentPrice}
                          onChange={e => onUpdatePrice(h.id, e.target.value)}
                          onBlur={e => onUpdatePriceBlur(h.id, e.target.value)}
                          className="w-20 px-1 py-0.5 rounded mono text-sm"
                          style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                        />
                      </td>
                      <td className="mono">{mv.toFixed(2)}</td>
                      <td className="mono" style={{ color: pl >= 0 ? COLORS.green : COLORS.red }}>
                        {pl >= 0 ? '+' : ''}{pl.toFixed(2)} <span className="text-[10px]">({plPct.toFixed(1)}%)</span>
                      </td>
                      <td><button onClick={() => onRemoveHolding(h.id)} className="opacity-50 hover:opacity-100"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {/* Price Alerts Panel */}
      <AlertsPanel alerts={alerts} onAddAlert={onAddAlert} onRemoveAlert={onRemoveAlert} lastRefreshed={lastRefreshed} />
    </div>
  );
}

// ===== PRICE ALERTS =====
function AlertsPanel({ alerts, onAddAlert, onRemoveAlert, lastRefreshed }) {
  const [form,    setForm]    = useState({ symbol: '', targetPrice: '', direction: 'above' });
  const [saving,  setSaving]  = useState(false);

  const add = async () => {
    if (!form.symbol || !form.targetPrice) return;
    setSaving(true);
    await onAddAlert({ symbol: form.symbol.toUpperCase(), targetPrice: parseFloat(form.targetPrice), direction: form.direction });
    setForm({ symbol: '', targetPrice: '', direction: 'above' });
    setSaving(false);
  };

  const active    = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered);

  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <h3 className="serif text-base font-semibold flex items-center gap-2">
          🔔 Price Alerts
          {active.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full mono" style={{ background: COLORS.amber + '22', color: COLORS.amber, border: `1px solid ${COLORS.amber}44` }}>{active.length} active</span>}
        </h3>
        {lastRefreshed && <span className="text-[11px] mono" style={{ color: COLORS.textDim }}>Checked {lastRefreshed.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      {/* Add alert form */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Symbol" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
          className="px-2 py-1.5 rounded text-sm mono w-24" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
        <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}
          className="px-2 py-1.5 rounded text-sm" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }}>
          <option value="above">rises above</option>
          <option value="below">drops below</option>
        </select>
        <input placeholder="Price" type="number" step="0.01" value={form.targetPrice} onChange={e => setForm({ ...form, targetPrice: e.target.value })}
          className="px-2 py-1.5 rounded text-sm mono w-24" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
        <button onClick={add} disabled={saving || !form.symbol || !form.targetPrice}
          className="px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 disabled:opacity-40"
          style={{ background: COLORS.amber, color: '#000' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Set Alert
        </button>
      </div>

      {/* Active alerts */}
      {active.length === 0 && triggered.length === 0 ? (
        <p className="text-sm" style={{ color: COLORS.textDim }}>No alerts set. Add one above to get notified when a price hits your target.</p>
      ) : (
        <div className="space-y-2">
          {active.map(a => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded text-sm" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
              <span>
                <span className="mono font-bold" style={{ color: COLORS.green }}>{a.symbol}</span>
                <span style={{ color: COLORS.textDim }}> {a.direction === 'above' ? '▲ rises above' : '▼ drops below'} </span>
                <span className="mono font-semibold" style={{ color: COLORS.amber }}>{a.targetPrice}</span>
              </span>
              <button onClick={() => onRemoveAlert(a.id)} className="opacity-50 hover:opacity-100"><Trash2 size={13} /></button>
            </div>
          ))}
          {triggered.map(a => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded text-sm opacity-50" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
              <span>
                <span className="mono font-bold">{a.symbol}</span>
                <span style={{ color: COLORS.textDim }}> {a.direction === 'above' ? '▲' : '▼'} {a.targetPrice} </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded mono" style={{ background: COLORS.green + '22', color: COLORS.green }}>✓ triggered</span>
              </span>
              <button onClick={() => onRemoveAlert(a.id)} className="opacity-50 hover:opacity-100"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ===== SIZING =====
function Sizing({ capital, setCapital, riskPct, setRiskPct }) {
  const [entry,      setEntry]      = useState('');
  const [stop,       setStop]       = useState('');
  const [target,     setTarget]     = useState('');
  const [brokerage,  setBrokerage]  = useState('0.10');  // % per side
  const [stampDuty,  setStampDuty]  = useState(true);   // Bursa Malaysia stamp duty toggle

  const e  = parseFloat(entry)     || 0;
  const s  = parseFloat(stop)      || 0;
  const t  = parseFloat(target)    || 0;
  const br = parseFloat(brokerage) || 0;

  const riskRM       = capital * (riskPct / 100);
  const riskPerShare = e - s;
  const maxShares    = riskPerShare > 0 ? Math.floor(riskRM / riskPerShare) : 0;
  const positionCost = maxShares * e;
  const potentialProfit = t > 0 ? maxShares * (t - e) : 0;
  const rrr = riskPerShare > 0 && t > 0 ? ((t - e) / riskPerShare).toFixed(2) : '—';

  // Transaction cost calculation
  const brokerBuy  = positionCost * (br / 100);
  const brokerSell = t > 0 ? (maxShares * t) * (br / 100) : positionCost * (br / 100);
  const stampBuy   = stampDuty ? Math.min(positionCost * 0.0015, 1000) : 0;
  const stampSell  = stampDuty ? Math.min((t > 0 ? maxShares * t : positionCost) * 0.0015, 1000) : 0;
  const totalCosts = brokerBuy + brokerSell + stampBuy + stampSell;
  const netProfit  = potentialProfit - totalCosts;

  // Break-even: entry price + total round-trip cost per share
  const breakEven  = maxShares > 0 ? e + totalCosts / maxShares : 0;

  return (
    <Panel>
      <h2 className="serif text-lg font-semibold mb-4">Position Sizing Calculator</h2>
      <p className="text-xs mb-4" style={{ color: COLORS.textDim }}>Rule #1: never risk more than 2% of capital on a single trade.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="Capital (RM)" value={capital} onChange={v => setCapital(parseFloat(v) || 0)} />
          <Field label="Risk per Trade (%)" value={riskPct} onChange={v => setRiskPct(parseFloat(v) || 0)} step="0.5" />
          <Field label="Entry Price" value={entry} onChange={setEntry} placeholder="2.30" />
          <Field label="Stop Loss" value={stop} onChange={setStop} placeholder="2.20" />
          <Field label="Target Price (optional)" value={target} onChange={setTarget} placeholder="2.60" />
          {/* Cost inputs */}
          <div>
            <label className="text-[11px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>Brokerage (% per side)</label>
            <input type="number" step="0.01" min="0" value={brokerage} onChange={e => setBrokerage(e.target.value)}
              placeholder="0.10"
              className="block w-full mt-1 px-3 py-2 rounded mono text-sm outline-none"
              style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="stampDuty" checked={stampDuty} onChange={e => setStampDuty(e.target.checked)}
              className="rounded" style={{ accentColor: COLORS.amber }} />
            <label htmlFor="stampDuty" className="text-xs cursor-pointer" style={{ color: COLORS.textDim }}>
              Bursa stamp duty (0.15%, max RM1,000 per trade)
            </label>
          </div>
        </div>
        <div className="space-y-3">
          <Result label="Max Risk (RM)" value={riskRM.toFixed(2)} color={COLORS.amber} />
          <Result label="Risk per Share" value={riskPerShare > 0 ? `RM ${riskPerShare.toFixed(2)}` : '—'} />
          <Result label="Max Shares" value={maxShares} highlight />
          <Result label="Gross Position Cost" value={`RM ${positionCost.toFixed(2)}`} />
          <Result label="Potential Gross Profit" value={potentialProfit > 0 ? `RM ${potentialProfit.toFixed(2)}` : '—'} color={COLORS.green} />
          <Result label="R:R Ratio" value={`1 : ${rrr}`} color={parseFloat(rrr) >= 2 ? COLORS.green : COLORS.amber} />
        </div>
      </div>

      {/* Transaction cost breakdown */}
      {maxShares > 0 && (
        <div className="mt-4 p-3 rounded" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
          <p className="text-xs font-semibold mb-2 mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>Transaction Costs (round-trip)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Brokerage (buy)</div>
              <div className="mono text-sm font-semibold" style={{ color: COLORS.text }}>RM {brokerBuy.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Brokerage (sell)</div>
              <div className="mono text-sm font-semibold" style={{ color: COLORS.text }}>RM {brokerSell.toFixed(2)}</div>
            </div>
            {stampDuty && (<>
              <div>
                <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Stamp duty (buy)</div>
                <div className="mono text-sm font-semibold" style={{ color: COLORS.amber }}>RM {stampBuy.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Stamp duty (sell)</div>
                <div className="mono text-sm font-semibold" style={{ color: COLORS.amber }}>RM {stampSell.toFixed(2)}</div>
              </div>
            </>)}
          </div>
          <div className="mt-3 pt-3 grid grid-cols-3 gap-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <div>
              <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Total Costs</div>
              <div className="mono text-sm font-bold" style={{ color: COLORS.red }}>RM {totalCosts.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Net Profit (after costs)</div>
              <div className="mono text-sm font-bold" style={{ color: netProfit >= 0 ? COLORS.green : COLORS.red }}>
                {netProfit >= 0 ? '+' : ''}RM {netProfit.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] mono" style={{ color: COLORS.textDim }}>Break-even Price</div>
              <div className="mono text-sm font-bold" style={{ color: COLORS.blue }}>RM {breakEven.toFixed(3)}</div>
            </div>
          </div>
        </div>
      )}

      {parseFloat(rrr) > 0 && parseFloat(rrr) < 2 && (
        <div className="mt-4 p-3 rounded text-xs" style={{ background: 'rgba(245, 158, 11, 0.1)', border: `1px solid ${COLORS.amber}`, color: COLORS.amber }}>
          ⚠ R:R below 1:2 — consider skipping. Pro traders require 1:2 minimum.
        </div>
      )}
    </Panel>
  );
}

// ===== CHAT =====
function Chat({ holdings, capital, cash, userName = 'Trader' }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: `Hey ${userName}. I'm your AI trading analyst. I know your portfolio and capital. Ask me anything — about a stock, a strategy, or just bounce ideas.` }]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(''); setLoading(true);
    try {
      const portfolioStr = holdings.map(h => `${h.symbol}: ${h.qty} @ ${h.avgCost}, now ${h.currentPrice}`).join('; ') || 'None';
      const context = `You are an experienced trading analyst advising Malaysian retail trader ${userName}.
CONTEXT: Capital RM${capital}, Cash RM${cash}, Holdings: ${portfolioStr}. Markets: US ETFs (VOO/SPY), Bursa Malaysia. Early-stage trader. 2% risk per trade.

CONVERSATION:
${updated.map(m => `${m.role === 'user' ? userName.toUpperCase() : 'YOU'}: ${m.content}`).join('\n')}

Respond as analyst. Direct, specific, practical. No fluff. Under 200 words unless detail is essential.`;
      const result = await callClaude(context, 800);
      setMessages([...updated, { role: 'assistant', content: result }]);
    } catch (e) { setMessages([...updated, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setLoading(false);
  };

  return (
    <Panel>
      <h2 className="serif text-lg font-semibold mb-3 flex items-center gap-2"><MessageSquare size={16} /> AI Trader Chat</h2>
      <div ref={scrollRef} className="h-[420px] overflow-y-auto scrollbar pr-2 space-y-3 mb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] p-3 rounded-lg text-sm leading-relaxed" style={{ background: m.role === 'user' ? COLORS.green : COLORS.panelLight, color: m.role === 'user' ? '#000' : COLORS.text, border: m.role === 'user' ? 'none' : `1px solid ${COLORS.border}` }}>
              {m.role === 'user' ? m.content : <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="p-3 rounded-lg" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}><Loader2 size={14} className="animate-spin" /></div></div>}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about a stock, strategy, or trade idea..." className="flex-1 px-3 py-2 rounded text-sm outline-none" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
        <button onClick={send} disabled={loading || !input.trim()} className="px-4 rounded disabled:opacity-50" style={{ background: COLORS.green, color: '#000' }}><Send size={14} /></button>
      </div>
    </Panel>
  );
}

// ===== P&L CALENDAR =====
function PnlCalendar({ trades }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  // Sum P/L per date string "YYYY-MM-DD"
  const byDate = {};
  trades.forEach(t => {
    if (t.date) byDate[t.date] = (byDate[t.date] || 0) + (t.pnl || 0);
  });

  const { year, month } = view;
  const firstDow   = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleString('en-MY', { month: 'long', year: 'numeric' });

  const prev = () => { const d = new Date(year, month - 1, 1); setView({ year: d.getFullYear(), month: d.getMonth() }); };
  const next = () => { const d = new Date(year, month + 1, 1); setView({ year: d.getFullYear(), month: d.getMonth() }); };

  // Build flat cell array: null = empty leading slot, or { day, pnl }
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d   = i + 1;
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { day: d, pnl: byDate[key] ?? null };
    }),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <h3 className="serif text-base font-semibold">P&amp;L Calendar</h3>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="px-2 py-1 rounded text-xs" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>‹</button>
          <span className="text-sm mono min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={next} className="px-2 py-1 rounded text-xs" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>›</button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] mono py-1" style={{ color: COLORS.textDim }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="rounded" style={{ minHeight: 44 }} />;
          const hasTrade = cell.pnl !== null;
          const bg = !hasTrade ? COLORS.panelLight
            : cell.pnl > 0  ? 'rgba(16,185,129,0.18)'
            : cell.pnl < 0  ? 'rgba(239,68,68,0.18)'
            : COLORS.panelLight;
          const tc = !hasTrade ? COLORS.textDim
            : cell.pnl > 0  ? COLORS.green
            : cell.pnl < 0  ? COLORS.red
            : COLORS.textDim;
          return (
            <div key={i} className="rounded p-1 flex flex-col items-center justify-start" style={{ background: bg, minHeight: 44 }}>
              <span className="text-[11px] mono font-semibold" style={{ color: tc }}>{cell.day}</span>
              {hasTrade && (
                <span className="text-[9px] mono leading-tight mt-0.5" style={{ color: tc }}>
                  {cell.pnl >= 0 ? '+' : ''}{cell.pnl.toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: COLORS.textDim }}>
          <div className="w-3 h-3 rounded" style={{ background: 'rgba(16,185,129,0.3)' }} /> Profit day
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: COLORS.textDim }}>
          <div className="w-3 h-3 rounded" style={{ background: 'rgba(239,68,68,0.3)' }} /> Loss day
        </div>
      </div>
    </Panel>
  );
}

// ===== JOURNAL =====
function Journal({ trades, onAddTrade, onRemoveTrade }) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], symbol: '', entry: '', exit: '', qty: '', notes: '' });
  const [pattern, setPattern] = useState(''); const [loadingPattern, setLoadingPattern] = useState(false);

  const add = async () => {
    if (!form.symbol || !form.entry || !form.exit || !form.qty) return;
    setSaving(true);
    const pnl = (parseFloat(form.exit) - parseFloat(form.entry)) * parseFloat(form.qty);
    await onAddTrade({ ...form, exit: parseFloat(form.exit), entry: parseFloat(form.entry), qty: parseFloat(form.qty), pnl });
    setForm({ date: new Date().toISOString().split('T')[0], symbol: '', entry: '', exit: '', qty: '', notes: '' });
    setShowAdd(false);
    setSaving(false);
  };
  const remove = (id) => onRemoveTrade(id);

  const analyzePatterns = async () => {
    if (trades.length < 3) { setPattern('Need at least 3 trades to analyze patterns.'); return; }
    setLoadingPattern(true);
    try {
      const tradesStr = trades.map(t => `${t.date}: ${t.symbol}, ${t.entry}→${t.exit}, qty ${t.qty}, P/L ${t.pnl.toFixed(2)}, notes: ${t.notes || '—'}`).join('\n');
      const prompt = `Review these trades and identify 3 behavioral patterns plus 2 actionable improvements. Be specific.\n\nTRADES:\n${tradesStr}\n\nShort paragraphs, max 200 words.`;
      setPattern(await callClaude(prompt, 600));
    } catch (e) { setPattern('Failed to analyze: ' + e.message); }
    setLoadingPattern(false);
  };

  const totalPL = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Trades" value={trades.length} sub="Logged" />
        <StatCard label="Win Rate" value={`${winRate}%`} sub={`${wins} wins`} color={parseFloat(winRate) >= 50 ? COLORS.green : COLORS.amber} />
        <StatCard label="Total P/L" value={`${totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)}`} sub="RM" color={totalPL >= 0 ? COLORS.green : COLORS.red} />
      </div>
      <PnlCalendar trades={trades} />
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <h2 className="serif text-lg font-semibold">Trading Journal</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded" style={{ background: COLORS.green, color: '#000' }}><Plus size={14} /> Log</button>
        </div>
        {showAdd && (
          <div className="mb-4 p-3 rounded space-y-2" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="px-2 py-1.5 rounded text-sm" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <input placeholder="Symbol" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <input placeholder="Entry" type="number" step="0.01" value={form.entry} onChange={e => setForm({ ...form, entry: e.target.value })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <input placeholder="Exit" type="number" step="0.01" value={form.exit} onChange={e => setForm({ ...form, exit: e.target.value })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
              <input placeholder="Qty" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} className="px-2 py-1.5 rounded text-sm mono" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
            </div>
            <textarea placeholder="Notes / lesson..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-2 py-1.5 rounded text-sm" rows={2} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
            <button onClick={add} disabled={saving} className="px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 disabled:opacity-50" style={{ background: COLORS.green, color: '#000' }}>
              {saving && <Loader2 size={12} className="animate-spin" />} Save Trade
            </button>
          </div>
        )}
        {trades.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: COLORS.textDim }}>No trades logged.</p>
        ) : (
          <div className="space-y-2">
            {trades.map(t => (
              <div key={t.id} className="p-3 rounded flex items-start justify-between gap-2" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold">{t.symbol}</span>
                    <span className="text-xs mono" style={{ color: COLORS.textDim }}>{t.date}</span>
                    <span className="text-xs mono">{t.qty} @ {t.entry} → {t.exit}</span>
                    <span className="text-sm mono font-semibold" style={{ color: t.pnl >= 0 ? COLORS.green : COLORS.red }}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}</span>
                  </div>
                  {t.notes && <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>{t.notes}</p>}
                </div>
                <button onClick={() => remove(t.id)} className="opacity-50"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h3 className="serif text-base font-semibold flex items-center gap-2"><Zap size={14} style={{ color: COLORS.amber }} /> AI Pattern Analysis</h3>
          <button onClick={analyzePatterns} disabled={loadingPattern} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded" style={{ color: COLORS.textDim, border: `1px solid ${COLORS.border}` }}>{loadingPattern ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Analyze</button>
        </div>
        {pattern ? <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none"><ReactMarkdown>{pattern}</ReactMarkdown></div> : <p className="text-sm" style={{ color: COLORS.textDim }}>Log at least 3 trades, then analyze.</p>}
      </Panel>
    </div>
  );
}

// ===== DIVIDEND TRACKER =====
function DividendTracker({ holdings, watchlist, usdMyr = 4.40 }) {
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const isUS  = (sym) => !sym?.toUpperCase().endsWith('.KL');
  const symbols = [...new Set([...holdings.map(h => h.symbol), ...watchlist.map(w => w.symbol)])];

  const load = async () => {
    if (!symbols.length) return;
    setLoading(true);
    const results = await Promise.all(
      symbols.map(sym =>
        fetch(`${API_BASE}/api/market/dividend/${encodeURIComponent(sym)}`)
          .then(r => r.ok ? r.json() : { symbol: sym, error: 'Failed' })
          .catch(() => ({ symbol: sym, error: 'Failed' }))
      )
    );
    const map = {};
    results.forEach(r => { if (r.symbol) map[r.symbol] = r; });
    setData(map);
    setLoading(false);
    setLoaded(true);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const holdingQty = (sym) => holdings.find(h => h.symbol === sym)?.qty || 0;

  const fmtDate = (ts) => {
    if (!ts) return '—';
    return new Date(Number(ts) * 1000).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const isFuture = (ts) => ts && Number(ts) * 1000 > Date.now();

  // Sort by ex-div date ascending, nulls last
  const sorted = symbols.filter(s => data[s] && !data[s].error).sort((a, b) => {
    const da = data[a]?.exDivDate || 0, db = data[b]?.exDivDate || 0;
    if (da && db) return Number(da) - Number(db);
    return da ? -1 : db ? 1 : a.localeCompare(b);
  });

  const totalIncome = holdings.reduce((sum, h) => {
    const d = data[h.symbol];
    if (!d || !(d.divRate > 0)) return sum;
    return sum + d.divRate * h.qty * (isUS(h.symbol) ? usdMyr : 1);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tracked" value={symbols.length} sub="symbols" />
        <StatCard label="Est. Annual Income" value={loaded ? `RM ${totalIncome.toFixed(2)}` : '—'} sub="From holdings" color={totalIncome > 0 ? COLORS.green : COLORS.textDim} />
        <StatCard label="Paying Dividends" value={loaded ? sorted.filter(s => (data[s]?.divRate || 0) > 0).length : '—'} sub={`of ${symbols.length}`} color={COLORS.amber} />
      </div>

      <Panel>
        <div className="flex items-center justify-between mb-4">
          <h2 className="serif text-lg font-semibold flex items-center gap-2">
            <DollarSign size={16} style={{ color: COLORS.green }} /> Dividend Tracker
          </h2>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded" style={{ color: COLORS.textDim, border: `1px solid ${COLORS.border}` }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
          </button>
        </div>

        {loading && !loaded && (
          <div className="flex items-center gap-2 py-8 justify-center" style={{ color: COLORS.textDim }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Fetching dividend data...</span>
          </div>
        )}

        {loaded && symbols.length === 0 && (
          <p className="text-sm py-8 text-center" style={{ color: COLORS.textDim }}>
            Add holdings or watchlist items first.
          </p>
        )}

        {loaded && symbols.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {['Symbol', 'Price', 'Div / Share', 'Yield', 'Ex-Date', 'Est. Annual Income'].map(h => (
                    <th key={h} className="text-left pb-2 pr-4 text-[10px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(sym => {
                  const d   = data[sym] || {};
                  const qty = holdingQty(sym);
                  const fx  = isUS(sym) ? usdMyr : 1;
                  const income = d.divRate > 0 && qty > 0 ? d.divRate * qty * fx : null;
                  const upcoming = isFuture(d.exDivDate);
                  const cur = isUS(sym) ? '$' : 'RM';
                  return (
                    <tr key={sym} className="border-b" style={{ borderColor: COLORS.border }}>
                      <td className="py-3 pr-4">
                        <div className="font-bold mono">{sym}</div>
                        <div className="text-[10px]" style={{ color: COLORS.textDim }}>{qty > 0 ? `${qty} units` : 'watchlist'}</div>
                      </td>
                      <td className="py-3 pr-4 mono">{d.price > 0 ? `${cur}${d.price}` : '—'}</td>
                      <td className="py-3 pr-4 mono">{d.divRate > 0 ? `${cur}${d.divRate.toFixed(4)}` : <span style={{ color: COLORS.textDim }}>—</span>}</td>
                      <td className="py-3 pr-4 mono" style={{ color: d.divYield > 0 ? COLORS.green : COLORS.textDim }}>
                        {d.divYield > 0 ? `${d.divYield.toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-3 pr-4 mono text-xs" style={{ color: upcoming ? COLORS.amber : COLORS.textDim }}>
                        {fmtDate(d.exDivDate)}{upcoming && <span className="ml-1" style={{ color: COLORS.amber }}>●</span>}
                      </td>
                      <td className="py-3 mono font-semibold" style={{ color: income ? COLORS.green : COLORS.textDim }}>
                        {income ? `RM ${income.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] mt-3" style={{ color: COLORS.textDim }}>
              Dividend data is trailing 12-month. Upcoming ex-dates marked ●. US dividends converted at {usdMyr} USD/MYR.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ===== OPTIONS CALCULATOR (Black-Scholes) =====
function _normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return x >= 0 ? 1 - p : p;
}
function _normalPDF(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

function _bsPrice(S, K, T, r, sigma) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return null;
  const sq = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sq);
  const d2 = d1 - sigma * sq;
  const Nd1 = _normalCDF(d1), Nd2 = _normalCDF(d2), nd1 = _normalPDF(d1);
  const Ke  = K * Math.exp(-r * T);
  const call = Math.max(0, S * Nd1 - Ke * Nd2);
  const put  = Math.max(0, Ke * _normalCDF(-d2) - S * _normalCDF(-d1));
  return {
    call, put,
    deltaCall:  Nd1,
    deltaPut:   Nd1 - 1,
    gamma:      nd1 / (S * sigma * sq),
    vega:       S * nd1 * sq / 100,                                          // per 1% vol
    thetaCall: (-(S * nd1 * sigma) / (2 * sq) - r * Ke * Nd2)          / 365,
    thetaPut:  (-(S * nd1 * sigma) / (2 * sq) + r * Ke * _normalCDF(-d2)) / 365,
    d1, d2,
  };
}

function OptionsCalc() {
  const [f, setF] = useState({ S: '', K: '', days: '', r: '4.5', iv: '', type: 'call' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const S = parseFloat(f.S) || 0, K = parseFloat(f.K) || 0;
  const T = (parseFloat(f.days) || 0) / 365;
  const r = (parseFloat(f.r) || 0) / 100, sigma = (parseFloat(f.iv) || 0) / 100;
  const bs = S && K && T && sigma ? _bsPrice(S, K, T, r, sigma) : null;

  const isCall = f.type === 'call';
  const price  = bs ? (isCall ? bs.call : bs.put) : null;
  const delta  = bs ? (isCall ? bs.deltaCall : bs.deltaPut) : null;
  const intrinsic = bs ? Math.max(0, isCall ? S - K : K - S) : 0;
  const itm = bs ? (isCall ? S > K : S < K) : null;
  const callColor = COLORS.green, putColor = COLORS.red;
  const typeColor = isCall ? callColor : putColor;

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="serif text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={16} style={{ color: COLORS.blue }} /> Options Calculator
          <span className="text-xs mono font-normal px-2 py-0.5 rounded" style={{ background: COLORS.panelLight, color: COLORS.textDim }}>Black-Scholes</span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Field label="Stock Price (S)" value={f.S} onChange={v => set('S', v)} placeholder="e.g. 210.00" />
          <Field label="Strike Price (K)" value={f.K} onChange={v => set('K', v)} placeholder="e.g. 215.00" />
          <Field label="Days to Expiry" value={f.days} onChange={v => set('days', v)} placeholder="e.g. 30" step="1" />
          <Field label="Risk-Free Rate %" value={f.r} onChange={v => set('r', v)} placeholder="e.g. 4.5" />
          <Field label="Implied Volatility %" value={f.iv} onChange={v => set('iv', v)} placeholder="e.g. 25" />
          <div>
            <label className="text-[11px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>Option Type</label>
            <div className="flex gap-2 mt-1">
              {['call', 'put'].map(t => (
                <button key={t} onClick={() => set('type', t)} className="flex-1 py-2 rounded text-sm font-semibold" style={{ background: f.type === t ? (t === 'call' ? callColor : putColor) : COLORS.panelLight, color: f.type === t ? '#000' : COLORS.textDim, border: `1px solid ${f.type === t ? (t === 'call' ? callColor : putColor) : COLORS.border}` }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {bs ? (
          <>
            {/* Premium */}
            <div className="flex items-center justify-between p-4 rounded-lg mb-4" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}` }}>
              <div>
                <div className="text-[10px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{f.type.toUpperCase()} Premium (theoretical)</div>
                <div className="mono text-4xl font-bold mt-1" style={{ color: typeColor }}>{price.toFixed(4)}</div>
                <div className="text-xs mono mt-1" style={{ color: COLORS.textDim }}>Intrinsic: {intrinsic.toFixed(4)} · Time value: {(price - intrinsic).toFixed(4)}</div>
              </div>
              <div className="text-right">
                <div className="mono text-sm px-3 py-1.5 rounded font-bold" style={{ background: itm ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: itm ? COLORS.green : COLORS.red, border: `1px solid ${itm ? COLORS.green : COLORS.red}` }}>
                  {itm ? 'ITM' : 'OTM'}
                </div>
                <div className="text-[10px] mono mt-2" style={{ color: COLORS.textDim }}>Both premiums: Call {bs.call.toFixed(4)} · Put {bs.put.toFixed(4)}</div>
              </div>
            </div>

            {/* Greeks */}
            <h3 className="mono text-xs uppercase tracking-wider mb-3" style={{ color: COLORS.textDim }}>The Greeks</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Delta (Δ)', value: delta?.toFixed(4), note: 'price Δ per $1 move', color: COLORS.blue },
                { label: 'Gamma (Γ)', value: bs.gamma.toFixed(6), note: 'delta Δ per $1 move', color: COLORS.amber },
                { label: 'Theta (Θ)', value: (isCall ? bs.thetaCall : bs.thetaPut).toFixed(4), note: 'time decay / day', color: COLORS.red },
                { label: 'Vega (ν)', value: bs.vega.toFixed(4), note: 'price Δ per 1% vol', color: COLORS.blue },
              ].map(g => (
                <div key={g.label} className="p-3 rounded" style={{ background: COLORS.panelLight }}>
                  <div className="text-[10px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{g.label}</div>
                  <div className="mono text-xl font-bold mt-1" style={{ color: g.color }}>{g.value}</div>
                  <div className="text-[9px] mono mt-1" style={{ color: COLORS.textDim }}>{g.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded mono text-[10px] flex gap-4 flex-wrap" style={{ background: COLORS.panelLight, color: COLORS.textDim }}>
              <span>d1: {bs.d1.toFixed(4)}</span>
              <span>d2: {bs.d2.toFixed(4)}</span>
              <span>T: {T.toFixed(6)} yrs</span>
              <span>σ: {(sigma * 100).toFixed(1)}%</span>
            </div>
          </>
        ) : (
          <div className="py-10 text-center" style={{ color: COLORS.textDim }}>
            <Activity size={36} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">Enter stock price, strike, expiry days, and IV to price the option</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ===== SHARED =====
function Panel({ children, accent }) {
  return <div className="rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderLeft: accent ? `3px solid ${accent}` : `1px solid ${COLORS.border}` }}>{children}</div>;
}
function StatCard({ label, value, sub, color }) {
  return <div className="rounded-lg p-3" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}><div className="text-[10px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{label}</div><div className="mono text-xl font-bold mt-1" style={{ color: color || COLORS.text }}>{value}</div><div className="text-[10px] mono mt-0.5" style={{ color: COLORS.textDim }}>{sub}</div></div>;
}
function Row({ label, value, mono }) {
  return <div className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}><span className="text-xs uppercase tracking-wider" style={{ color: COLORS.textDim }}>{label}</span><span className={mono ? 'mono text-sm' : 'text-sm'}>{value}</span></div>;
}
function PlanItem({ label, value, color }) {
  return <div className="rounded p-2" style={{ background: COLORS.panelLight }}><div className="text-[10px] mono uppercase" style={{ color: COLORS.textDim }}>{label}</div><div className="mono text-sm font-bold mt-0.5" style={{ color: color || COLORS.text }}>{value}</div></div>;
}
function Field({ label, value, onChange, placeholder, step = '0.01' }) {
  return <div><label className="text-[11px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{label}</label><input type="number" step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="block w-full mt-1 px-3 py-2 rounded mono text-sm outline-none" style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.text }} /></div>;
}
function Result({ label, value, color, highlight }) {
  return <div className="p-3 rounded" style={{ background: highlight ? 'rgba(16,185,129,0.08)' : COLORS.panelLight, border: `1px solid ${highlight ? COLORS.green : COLORS.border}` }}><div className="text-[10px] mono uppercase tracking-wider" style={{ color: COLORS.textDim }}>{label}</div><div className="mono text-lg font-bold mt-1" style={{ color: color || (highlight ? COLORS.green : COLORS.text) }}>{value}</div></div>;
}
