# Technical Architecture

Detailed technical reference for the AI Trade Desk codebase.

---

## Architecture Overview

```
User (Browser / iPhone)
        │
        ▼
   React SPA (Vite)
   ├── localStorage  ◄──── Portfolio, Journal, Settings
   └── fetch()
        │
        ▼
  Anthropic API
  (claude-sonnet-4-20250514)
```

No backend. No database. No authentication server. Everything runs client-side.

---

## Claude API Call Pattern

```javascript
async function callClaude(prompt, maxTokens = 1500) {
  const apiKey = localStorage.getItem('anthropic_api_key');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',  // Required for browser
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}
```

> **Note:** `anthropic-dangerous-direct-browser-access: true` is required because the Anthropic API is called directly from the browser. This is intentional for a personal, single-user tool.

---

## JSON Response Parsing

Claude's JSON responses are cleaned and parsed defensively:

```javascript
function parseJSON(text) {
  if (!text) return null;
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  let jsonStr = cleaned.slice(start, end + 1);
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');  // Remove trailing commas
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    return null;
  }
}
```

If JSON parsing fails, the Analyzer falls back to a plain-text prompt/response.

---

## Storage Layer

MVP 1 uses `localStorage`. Every state change writes through:

```javascript
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
```

React state is initialized from storage and synced back via `useEffect`:

```javascript
const [holdings, setHoldings] = useState(() => storage.get('portfolio:holdings', [...defaults]));
useEffect(() => { storage.set('portfolio:holdings', holdings); }, [holdings]);
```

---

## Component Structure (MVP 1 — Monolith)

All components live in `src/App.jsx`:

```
App (root)
├── SettingsModal
├── Header
├── Nav (tab bar)
├── DisclaimerBanner
├── Main
│   ├── Dashboard
│   │   ├── StatCard (×4)
│   │   ├── AIInsightPanel
│   │   ├── AllocationPieChart
│   │   └── HoldingsList
│   ├── Analyzer
│   │   ├── SearchBar
│   │   ├── SuggestionsList
│   │   ├── AnalyzingLoader
│   │   ├── VerdictCard
│   │   ├── TechnicalPanel + FundamentalPanel
│   │   ├── RisksPanel
│   │   ├── TradePlanPanel
│   │   └── FallbackTextPanel
│   ├── Portfolio
│   │   ├── AddHoldingForm
│   │   └── HoldingsTable
│   ├── Sizing
│   │   ├── InputFields
│   │   └── ResultCards
│   ├── Chat
│   │   ├── MessageList
│   │   └── InputBar
│   └── Journal
│       ├── StatsRow
│       ├── AddTradeForm
│       ├── TradeList
│       └── PatternAnalysis
├── Footer
└── FloatingAskAIButton
```

**Phase 2 refactor target:** Move each tab into `src/components/[TabName]/index.jsx`

---

## Planned Phase 2 File Structure

```
src/
├── components/
│   ├── Dashboard/
│   │   └── index.jsx
│   ├── Analyzer/
│   │   └── index.jsx
│   ├── Portfolio/
│   │   └── index.jsx
│   ├── Sizing/
│   │   └── index.jsx
│   ├── Chat/
│   │   └── index.jsx
│   ├── Journal/
│   │   └── index.jsx
│   └── ui/
│       ├── Panel.jsx
│       ├── StatCard.jsx
│       ├── PlanItem.jsx
│       ├── Field.jsx
│       └── Result.jsx
├── lib/
│   ├── claude.js          # callClaude(), parseJSON()
│   ├── storage.js         # storage helpers
│   └── constants.js       # COLORS, PIE_COLORS
├── hooks/
│   └── usePortfolio.js    # portfolio state + persistence
├── App.jsx                # Layout + routing only
├── main.jsx
└── index.css
```

---

## Prompt Engineering Notes

### Stock Search Prompt
- Returns JSON with `matchType`: `exact`, `suggestions`, or `none`
- Handles: exact tickers, partial names, keywords (`tech etf`, `malaysia bank`)
- `max_tokens: 800` — fast, lightweight

### Stock Analysis Prompt
- Returns structured JSON with 7 top-level keys
- Prompt starts with `CRITICAL: Respond with ONLY a single valid JSON object. Start with { end with }.`
- Fallback to plain-text if JSON fails
- `max_tokens: 2000` — needs space for full plan

### Chat Advisor Prompt
- Injects full portfolio context as system-level info
- Instructs: direct, specific, under 200 words unless essential
- Full message history included each call (stateless API, stateful app)
- `max_tokens: 800`

---

## Build & Deploy

```bash
# Development
npm run dev          # Vite dev server at localhost:5173

# Production build
npm run build        # Outputs to /dist
npm run preview      # Preview /dist locally

# Deploy (automatic via Vercel git integration)
git push             # Triggers Vercel rebuild (~60 seconds)
```

### Vercel Config (`vercel.json`)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```
Ensures all routes serve `index.html` (SPA requirement).

---

## Environment Notes

- No `.env` file needed — API key is user-entered at runtime
- No server-side secrets
- CORS is handled by Anthropic API (`anthropic-dangerous-direct-browser-access` header)
- Tailwind compiles via PostCSS at build time — no CDN dependency in production
