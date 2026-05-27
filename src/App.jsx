import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Wallet, Search, Calculator, MessageSquare, BookOpen, LayoutDashboard, Plus, Trash2, Send, Loader2, AlertTriangle, Target, Shield, Zap, RefreshCw, X, Settings, LogOut } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { supabase, getProfile, updateApiKey, getPortfolio, addHolding, removeHolding, updateHoldingPrice, replacePortfolio, saveCash } from './lib/supabase';
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

  const [tab,          setTab]          = useState('dashboard');
  const [holdings,     setHoldings]     = useState([]);
  const [cash,         setCash]         = useState(0);
  const [capital,      setCapital]      = useState(() => storage.get('settings:capital', 1000));
  const [riskPct,      setRiskPct]      = useState(() => storage.get('settings:riskPct', 2));
  const [trades,       setTrades]       = useState(() => storage.get('journal:trades', []));
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const cashSaveRef = useRef(null);

  // ── Settings still in localStorage (device-specific) ──────────────────────
  useEffect(() => { storage.set('settings:capital', capital); }, [capital]);
  useEffect(() => { storage.set('settings:riskPct', riskPct); }, [riskPct]);
  useEffect(() => { storage.set('journal:trades', trades); }, [trades]);

  // ── Load portfolio from Supabase on login ──────────────────────────────────
  useEffect(() => {
    (async () => {
      setPortfolioLoading(true);
      try {
        const [rows, prof] = await Promise.all([
          getPortfolio(userId),
          getProfile(userId),
        ]);
        setHoldings(rows);
        setCash(Number(prof?.cash ?? 0));
      } catch (e) {
        console.error('Failed to load portfolio:', e);
      }
      setPortfolioLoading(false);
    })();
  }, [userId]);

  // ── Cash change — debounced save to Supabase ───────────────────────────────
  const handleCashChange = (val) => {
    const num = parseFloat(val) || 0;
    setCash(num);
    clearTimeout(cashSaveRef.current);
    cashSaveRef.current = setTimeout(() => {
      saveCash(userId, num).catch(console.error);
    }, 800);
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
    const p = parseFloat(price) || 0;
    setHoldings(prev => prev.map(h => h.id === holdingId ? { ...h, currentPrice: p } : h));
  };

  const handleUpdatePriceBlur = (holdingId, price) => {
    const p = parseFloat(price) || 0;
    if (p > 0) updateHoldingPrice(holdingId, p).catch(console.error);
  };

  const handleReplacePortfolio = async (newHoldings) => {
    try {
      const saved = await replacePortfolio(userId, newHoldings);
      setHoldings(saved);
    } catch (e) { console.error('Replace portfolio failed:', e); throw e; }
  };

  // ── Live price refresh ─────────────────────────────────────────────────────
  const refreshPrices = async () => {
    const symbols = holdings.map(h => h.symbol).filter(Boolean);
    if (!symbols.length) return;
    setRefreshing(true);
    try {
      const entries = await Promise.all(symbols.map(async sym => [sym, await fetchLivePrice(sym)]));
      const updates = {};
      entries.forEach(([sym, data]) => { if (data?.price) updates[sym] = data.price; });

      setHoldings(prev => prev.map(h => ({
        ...h,
        currentPrice: updates[h.symbol] ?? h.currentPrice,
      })));

      // Persist updated prices to Supabase
      await Promise.all(
        holdings
          .filter(h => updates[h.symbol])
          .map(h => updateHoldingPrice(h.id, updates[h.symbol]))
      );
    } catch (e) { console.error('Price refresh failed:', e); }
    setRefreshing(false);
  };

  const portfolioValue = holdings.reduce((sum, h) => sum + h.qty * h.currentPrice, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.qty * h.avgCost, 0);
  const positionPL = portfolioValue - totalCost;
  const totalAssets = portfolioValue + cash;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analyzer', label: 'Analyzer', icon: Search },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'sizing', label: 'Sizing', icon: Calculator },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'journal', label: 'Journal', icon: BookOpen },
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

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
        {tab === 'dashboard' && <Dashboard holdings={holdings} cash={cash} totalAssets={totalAssets} positionPL={positionPL} portfolioValue={portfolioValue} setTab={setTab} />}
        {tab === 'analyzer' && <Analyzer capital={capital} />}
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
          />
        )}
        {tab === 'sizing' && <Sizing capital={capital} setCapital={setCapital} riskPct={riskPct} setRiskPct={setRiskPct} />}
        {tab === 'chat' && <Chat holdings={holdings} capital={capital} cash={cash} userName={userName} />}
        {tab === 'journal' && <Journal trades={trades} setTrades={setTrades} />}
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

// ===== SETTINGS MODAL =====
function SettingsModal({ onClose }) {
  const [apiKey,       setApiKey]       = useState(localStorage.getItem('anthropic_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('claude_model') || DEFAULT_MODEL);
  const [saved,        setSaved]        = useState(false);

  const save = async () => {
    const trimmed = apiKey.trim();
    localStorage.setItem('anthropic_api_key', trimmed);
    localStorage.setItem('claude_model', selectedModel);
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

          <button onClick={save} className="w-full py-2 rounded font-semibold text-sm" style={{ background: COLORS.green, color: '#000' }}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== DASHBOARD =====
function Dashboard({ holdings, cash, totalAssets, positionPL, portfolioValue, setTab }) {
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Assets" value={`RM ${totalAssets.toFixed(2)}`} sub="MYR" />
        <StatCard label="Market Value" value={`RM ${portfolioValue.toFixed(2)}`} sub={`${holdings.length} position${holdings.length !== 1 ? 's' : ''}`} />
        <StatCard label="Position P/L" value={`${positionPL >= 0 ? '+' : ''}${positionPL.toFixed(2)}`} sub={portfolioValue > 0 ? `${((positionPL / (portfolioValue - positionPL)) * 100).toFixed(2)}%` : '—'} color={positionPL >= 0 ? COLORS.green : COLORS.red} />
        <StatCard label="Cash" value={`RM ${cash.toFixed(2)}`} sub="Available" />
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
          <p className="text-sm leading-relaxed">{insight}</p>
        ) : (
          <p className="text-sm" style={{ color: COLORS.textDim }}>Click "Generate" for today's AI-powered market insight.</p>
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
                const pl = (h.currentPrice - h.avgCost) * h.qty;
                const plPct = ((h.currentPrice - h.avgCost) / h.avgCost) * 100;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: COLORS.border }}>
                    <div>
                      <div className="font-semibold text-sm">{h.symbol}</div>
                      <div className="text-[11px] mono" style={{ color: COLORS.textDim }}>{h.qty} @ {h.avgCost}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-sm">{(h.qty * h.currentPrice).toFixed(2)}</div>
                      <div className="text-[11px] mono" style={{ color: pl >= 0 ? COLORS.green : COLORS.red }}>
                        {pl >= 0 ? '+' : ''}{pl.toFixed(2)} ({plPct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ===== ANALYZER =====
function Analyzer({ capital }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [fallbackText, setFallbackText] = useState('');
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

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
        <Panel accent={COLORS.amber}>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} style={{ color: COLORS.amber }} /><h3 className="serif text-base font-semibold">Analysis (Text Mode)</h3></div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{fallbackText}</div>
        </Panel>
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

// ===== PORTFOLIO =====
function Portfolio({ holdings, onAddHolding, onRemoveHolding, onUpdatePrice, onUpdatePriceBlur, onReplacePortfolio, cash, onCashChange, refreshPrices, refreshing, loading }) {
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
    </div>
  );
}

// ===== SIZING =====
function Sizing({ capital, setCapital, riskPct, setRiskPct }) {
  const [entry, setEntry] = useState(''); const [stop, setStop] = useState(''); const [target, setTarget] = useState('');
  const e = parseFloat(entry) || 0, s = parseFloat(stop) || 0, t = parseFloat(target) || 0;
  const riskRM = capital * (riskPct / 100);
  const riskPerShare = e - s;
  const maxShares = riskPerShare > 0 ? Math.floor(riskRM / riskPerShare) : 0;
  const positionCost = maxShares * e;
  const potentialProfit = t > 0 ? maxShares * (t - e) : 0;
  const rrr = riskPerShare > 0 && t > 0 ? ((t - e) / riskPerShare).toFixed(2) : '—';

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
        </div>
        <div className="space-y-3">
          <Result label="Max Risk (RM)" value={riskRM.toFixed(2)} color={COLORS.amber} />
          <Result label="Risk per Share" value={riskPerShare > 0 ? `RM ${riskPerShare.toFixed(2)}` : '—'} />
          <Result label="Max Shares" value={maxShares} highlight />
          <Result label="Position Cost" value={`RM ${positionCost.toFixed(2)}`} />
          <Result label="Potential Profit" value={potentialProfit > 0 ? `RM ${potentialProfit.toFixed(2)}` : '—'} color={COLORS.green} />
          <Result label="R:R Ratio" value={`1 : ${rrr}`} color={parseFloat(rrr) >= 2 ? COLORS.green : COLORS.amber} />
        </div>
      </div>
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
            <div className="max-w-[85%] p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap" style={{ background: m.role === 'user' ? COLORS.green : COLORS.panelLight, color: m.role === 'user' ? '#000' : COLORS.text, border: m.role === 'user' ? 'none' : `1px solid ${COLORS.border}` }}>{m.content}</div>
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

// ===== JOURNAL =====
function Journal({ trades, setTrades }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], symbol: '', entry: '', exit: '', qty: '', notes: '' });
  const [pattern, setPattern] = useState(''); const [loadingPattern, setLoadingPattern] = useState(false);

  const add = () => {
    if (!form.symbol || !form.entry || !form.exit || !form.qty) return;
    const pnl = (parseFloat(form.exit) - parseFloat(form.entry)) * parseFloat(form.qty);
    setTrades([{ ...form, pnl, id: Date.now() }, ...trades]);
    setForm({ date: new Date().toISOString().split('T')[0], symbol: '', entry: '', exit: '', qty: '', notes: '' });
    setShowAdd(false);
  };
  const remove = (id) => setTrades(trades.filter(t => t.id !== id));

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
            <button onClick={add} className="px-3 py-1.5 rounded text-sm font-semibold" style={{ background: COLORS.green, color: '#000' }}>Save Trade</button>
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
        {pattern ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{pattern}</p> : <p className="text-sm" style={{ color: COLORS.textDim }}>Log at least 3 trades, then analyze.</p>}
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
