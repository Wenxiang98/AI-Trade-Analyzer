# MVP 1 — Core Trading Desk

## Status: ✅ Built & Deployable

MVP 1 is the first complete, deployable version of AI Trade Desk. It covers all essential functionality a solo retail trader needs.

---

## Modules Included

### 1. 📊 Dashboard
- Total Assets, Market Value, Position P/L, Cash cards
- Portfolio allocation pie chart (Recharts)
- Holdings list with live P/L per position
- **AI Daily Insight** — Claude generates a personalized market thought on demand
- Quick navigation to Portfolio manager

### 2. 🔍 Smart Stock Analyzer
Two-step flow:

**Step 1 — Search**
- User types ticker, company name, or keyword (e.g. `VOO`, `apple`, `tech etf`, `malaysia bank`)
- Claude returns: exact match (auto-proceeds to analysis) or suggestions list (user picks)
- Quick-pick chips for common tickers in empty state

**Step 2 — Analysis**
- **Verdict card:** BUY / SELL / HOLD with confidence score (1-10)
- **Technical snapshot:** trend, momentum, support, resistance
- **Fundamental quick-look:** what it is, sector context
- **Risks:** 3 specific risks to the trade
- **AI Trade Plan:** entry zone, stop loss, target, position size in RM at 2% risk
- **Fallback:** if JSON parsing fails, returns plain-text analysis instead of error

### 3. 💼 Portfolio Manager
- Add / edit / delete holdings (Symbol, Qty, Avg Cost, Current Price, Market)
- Inline price editing — update current price to refresh P/L
- Cash balance input
- Auto-calculates: Market Value, P/L in RM, P/L %
- Pre-loaded with SUNREIT 300 units @ RM 2.16
- Data persists via `localStorage`

### 4. ⚖️ Position Sizing Calculator
- Inputs: Capital, Risk %, Entry Price, Stop Loss, Target Price
- Outputs: Max Risk (RM), Risk per Share, Max Shares to Buy, Position Cost, Potential Profit, R:R Ratio
- Built-in 2% rule enforcement
- Warning banner when R:R < 1:2

### 5. 🤖 AI Trader Chat
- Claude acts as Wen Xiang's personal trading analyst
- Pre-loaded context: portfolio, capital, cash, markets of interest, experience level
- Chat history persists within session
- Example prompts surfaced in UI
- Floating "Ask AI" button visible from all tabs

### 6. 📓 Trading Journal
- Log trades: Date, Symbol, Entry, Exit, Qty, Notes
- Auto-calculates P/L per trade
- Stats: Total Trades, Win Rate, Total P/L
- **AI Pattern Analysis:** Claude reviews logged trades and identifies behavioral patterns + improvement areas (requires 3+ trades)
- Data persists via `localStorage`

### 7. ⚙️ Settings Modal
- Anthropic API key input (stored in `localStorage`, never committed to git)
- Link to console.anthropic.com for key generation

---

## Claude API Integration Points

| Feature | Prompt Type | Max Tokens |
|---|---|---|
| Stock search (match/suggest) | JSON response | 800 |
| Stock analysis (structured) | JSON response | 2000 |
| Stock analysis (fallback) | Text response | 1500 |
| Dashboard daily insight | Text response | 400 |
| Chat advisor | Text response | 800 |
| Journal pattern analysis | Text response | 600 |

---

## Data Schema (`localStorage` keys)

```javascript
'portfolio:holdings'   // [{symbol, qty, avgCost, currentPrice, market}]
'portfolio:cash'       // number — RM cash balance
'journal:trades'       // [{id, date, symbol, entry, exit, qty, pnl, notes}]
'settings:capital'     // number — trading capital (default 1000)
'settings:riskPct'     // number — % risk per trade (default 2)
'anthropic_api_key'    // string — user's API key
```

---

## Known Limitations in MVP 1

| Limitation | Impact | Fix in Phase |
|---|---|---|
| No real-time price data | Manual price updates only | Phase 2 |
| No cross-device sync | Data only on one browser | Phase 2 |
| Monolith `App.jsx` | Harder to maintain as features grow | Phase 2 refactor |
| API key client-side | Not suitable for shared/public deployment | Phase 2 |
| No PWA manifest | "Add to home screen" is basic | Phase 2 |
