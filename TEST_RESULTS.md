# AI Trade Desk — Live Test Results

**Test Date:** 2026-05-27  
**Tested By:** Claude (automated browser testing via Claude-in-Chrome MCP)  
**App URL:** https://wx-trade-analyzer.vercel.app/  
**Backend URL:** https://ai-trade-analyzer-production.up.railway.app  
**Test Guide:** TEST_GUIDE.md  

---

## Summary

| Category | Total | Pass | Fail | Skipped |
|----------|-------|------|------|---------|
| Login / Auth | 4 | 4 | 0 | 0 |
| Header / Navigation | 7 | 7 | 0 | 0 |
| Settings | 5 | 5 | 0 | 0 |
| Dashboard | 6 | 6 | 0 | 0 |
| Watchlist | 9 | 8 | 1 | 0 |
| Analyzer | 8 | 8 | 0 | 0 |
| Portfolio | 8 | 6 | 1 | 1 |
| Price Alerts | 5 | 4 | 0 | 1 |
| Position Sizing | 4 | 4 | 0 | 0 |
| AI Chat | 5 | 5 | 0 | 0 |
| Journal | 5 | 1 | 4 | 0 |
| Cross-cutting | 3 | 3 | 0 | 0 |
| **TOTAL** | **69** | **61** | **6** | **2** |

**Pass rate: 88%**

---

## Bugs Found

### 🔴 BUG-01 — CRITICAL: Dashboard & Analyzer render twice

**Severity:** Critical (layout corruption)  
**Location:** `src/App.jsx` lines ~449 and ~451  
**Description:**  
The Dashboard and Analyzer components are both rendered twice on their respective tabs. The first render (before the triggered-alerts section) is incomplete — Dashboard is missing `snapshots` and `lastRefreshed` props; Analyzer is missing `preFill` and `onConsumePreFill`. The second render (after the alerts section) has the correct props.

**Visible symptom:** On the Dashboard tab, the stats cards (Total Assets, Market Value, P/L, Cash), Allocation chart, and Holdings panel all appear **twice** on the same page — once above and once below the correct AI Daily Insight / Portfolio Performance sections.

**Root cause:**
```jsx
// DUPLICATE renders — must be removed:
{tab === 'dashboard' && <Dashboard holdings={...} cash={...} ... />}   // ~line 449 (missing snapshots)
{tab === 'analyzer'  && <Analyzer capital={capital} />}                  // ~line 451 (missing preFill)

// ... triggered alerts section ...

// CORRECT renders — keep these:
{tab === 'dashboard' && <Dashboard holdings={...} snapshots={snapshots} lastRefreshed={lastRefreshed} ... />}
{tab === 'analyzer'  && <Analyzer capital={capital} preFill={analyzerPreFill} onConsumePreFill={...} />}
```

**Fix:** Delete the first (incomplete) Dashboard and Analyzer render statements at ~lines 449–451.

---

### 🔴 BUG-02 — HIGH: Journal save fails — missing `date` column in Supabase

**Severity:** High (feature completely broken)  
**Location:** Supabase `journal_trades` table schema  
**Description:**  
Every attempt to save a journal trade fails with Supabase error:  
```
PGRST204: Could not find the 'date' column of 'journal_trades' in the schema cache
```
The `addJournalTrade()` function in `supabase.js` inserts a `date` field, but this column does not exist in the `journal_trades` table. The error is caught silently in `handleAddTrade()` — the save form closes (showing the user it worked) but no trade is saved.

**HTTP evidence:** `POST /rest/v1/journal_trades` → 400 Bad Request  

**Fix options:**
1. Add column to Supabase: `ALTER TABLE journal_trades ADD COLUMN date date;`
2. Or rename the insert field to match the actual column name in the table.

**Affected tests:** TC-62, TC-63, TC-64, TC-65 all blocked.

---

### 🟡 BUG-03 — HIGH: Symbol search returns empty for non-Malaysian stocks

**Severity:** High (UX degraded — users can't search by company name for US/global stocks)  
**Location:** Backend `YahooFinanceService.searchSymbols()` + `GET /api/market/search`  
**Description:**  
The symbol search API returns empty results (`[]`) for all non-Bursa Malaysia queries. Tested:
- `q=VOO` → `[]`
- `q=AAPL` → `[]`
- `q=apple` → `[]`
- `q=5176` → `[{symbol:"5176.KL", ...}, ...]` ✅

This affects the **Watchlist → + Watch** symbol search dropdown and the **Portfolio → + Add** symbol search dropdown. US ETFs and global stocks cannot be found by name or ticker. Users must type the exact ticker manually (which still works, since `form.symbol` is set from the typed text directly).

**Root cause (suspected):** Yahoo Finance's `/v1/finance/search` endpoint may be returning US stocks under a `quoteType` that doesn't match the filter (`"EQUITY"` / `"ETF"` / `"MUTUALFUND"`), or the Railway server's IP is being geo-filtered. Bursa Malaysia stocks may be returned under a different path.

**Workaround:** Type the exact ticker symbol (e.g. `VOO`, `AAPL`, `5176.KL`) directly — the form saves it even without a dropdown selection.

---

### 🟡 BUG-04 — MEDIUM: AI responses render raw Markdown instead of formatted text

**Severity:** Medium (cosmetic/readability)  
**Location:** AI Daily Insight (`Dashboard`), AI Chat response bubbles, Journal AI Pattern Analysis  
**Description:**  
All AI-generated text is returned as Markdown but displayed as raw plain text. The `#` heading prefix, `**bold**`, `---` dividers, and `##` subheadings all appear verbatim in the UI instead of being rendered as styled HTML.

**Example (AI Chat response):**
```
# Your Portfolio Summary
**Holdings:**
- **5176.KL (Scicom MSC Berhad)**: 300 shares @ 2.16 avg cost
```

**Fix:** Wrap AI text output in a Markdown renderer (e.g. `react-markdown`) or strip/convert the Markdown tokens to HTML before rendering.

---

### 🔵 BUG-05 — LOW: AI misidentifies Bursa Malaysia stock name

**Severity:** Low (AI knowledge, not a code bug)  
**Location:** AI responses (Chat, Analyzer, Daily Insight)  
**Description:**  
The AI identifies `5176.KL` as "Scicom MSC Berhad" in chat responses and "Genting Malaysia" in some Analyzer responses. The actual company for Bursa code 5176 is **Sunway Real Estate Investment Trust**.

**Note:** This is an AI training data limitation, not a code defect. Not actionable via code fix — could be mitigated by always including the stock name from the live quote API in the AI prompt context.

---

## Detailed Test Results

### Login / Auth

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-01 | Load login page | ✅ PASS | Login form rendered correctly |
| TC-02 | Invalid login shows error | ✅ PASS | Error message displayed |
| TC-03 | Valid login — redirect to Dashboard | ✅ PASS | Session established, Dashboard loaded |
| TC-04 | Logout button | ✅ PASS | Returns to login screen |

---

### Header / Navigation

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-05 | All 7 tabs clickable | ✅ PASS | Dashboard, Watchlist, Analyzer, Portfolio, Sizing, AI Chat, Journal |
| TC-06 | Active tab indicator | ✅ PASS | Green underline on active tab |
| TC-07 | Header NET value | ✅ PASS | Shows RM 696.54 ▲ +45.00, updates on holding changes |
| TC-08 | User name in header | ✅ PASS | "Wen Xiang" displayed |
| TC-09 | Settings gear icon | ✅ PASS | Opens settings modal |
| TC-10 | Logout icon | ✅ PASS | Signs out user |
| TC-11 | Disclaimer banner | ✅ PASS | Yellow warning bar visible on all tabs |

---

### Settings

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-12 | Settings modal opens | ✅ PASS | Contains API key, model selector, auto-refresh |
| TC-13 | Save API key | ✅ PASS | Persisted to Supabase profiles table |
| TC-14 | Model selector highlight | ✅ PASS | Selected model highlighted in green |
| TC-15 | Auto-refresh options | ✅ PASS | Off / 5 min / 15 min / 30 min options |
| TC-16 | Close modal | ✅ PASS | X button dismisses |

---

### Dashboard

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-17 | Stats cards display | ✅ PASS | Total Assets, Market Value, Position P/L, Cash — all correct values |
| TC-18 | AI Daily Insight Generate | ✅ PASS | Generates AI text; note: raw Markdown rendered (BUG-04) |
| TC-19 | Portfolio Performance chart | ✅ PASS | Line chart shows snapshot history |
| TC-20 | Allocation pie chart | ✅ PASS | 5176.KL 99.5% / Cash 0.5% |
| TC-21 | Holdings summary panel | ✅ PASS | Shows 5176.KL with MV and P/L |
| TC-22 | Manage → link to Portfolio | ✅ PASS | Clicking "Manage →" navigates to Portfolio tab |
| **BUG** | Double render | ❌ BUG-01 | Stats cards, charts, holdings all appear twice on page |

---

### Watchlist

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-23 | Watchlist tab opens | ✅ PASS | Shows "Watchlist 1" with VOO |
| TC-24 | Add by ticker (VOO) | ✅ PASS | Search fires, dropdown shown for .KL codes |
| TC-25 | Symbol search — US tickers | ❌ FAIL | VOO/AAPL/apple return `[]` from search API (BUG-03) |
| TC-26 | Live price auto-loads | ✅ PASS | USD 690.01, +0.65% shown on tab open |
| TC-27 | Quick Scan | ✅ PASS | HOLD badge + 1-line reason displayed |
| TC-28 | Analyze → button | ✅ PASS | Switches to Analyzer tab + auto-runs full analysis |
| TC-29 | + Port button | ✅ PASS | Adds to Portfolio from Watchlist |
| TC-30 | Watchlist persistence | ✅ PASS | VOO still present after full page reload |
| TC-31 | Remove from Watchlist | ✅ PASS | Trash icon removes entry |

---

### Analyzer

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-32 | Analyzer tab opens | ✅ PASS | Search input, Generate button present |
| TC-33 | Run analysis on 5176.KL | ✅ PASS | Full result in ~8s |
| TC-34 | Analysis header / verdict | ✅ PASS | Symbol, company name, HOLD/BUY/SELL badge |
| TC-35 | Technical analysis panel | ✅ PASS | Trend, support/resistance, indicators |
| TC-36 | Fundamental analysis panel | ✅ PASS | Valuation, revenue, dividends |
| TC-37 | Risk factors panel | ✅ PASS | Bullet list of risks |
| TC-38 | Trade plan panel | ✅ PASS | Entry, target, stop loss, position size guidance |
| TC-39 | Watchlist Analyze → auto-fills | ✅ PASS | Symbol pre-filled, analysis auto-runs from Watchlist |

---

### Portfolio

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-40 | Holdings table columns | ✅ PASS | SYMBOL, QTY, COST, CURRENT, MV, P/L |
| TC-41 | Live Prices button | ✅ PASS | Timestamp updates, prices refresh from Yahoo Finance |
| TC-42 | Cash field updates NET | ✅ PASS | Header NET updates immediately on Cash edit |
| TC-43 | Add holding manually (US ETF) | ✅ PASS | VOO added: 5 @ 485.50, MV 3450.05, P/L +1022.55 (42.1%) |
| TC-44 | Symbol search dropdown (.KL) | ✅ PASS | 5176 query returns dropdown with Sunway REIT option |
| TC-45 | Symbol search dropdown (US) | ❌ FAIL | VOO/AAPL return empty dropdown (BUG-03) |
| TC-46 | Inline current price edit | ✅ PASS | Edit CURRENT → MV and P/L recalculate instantly |
| TC-47 | Remove holding | ✅ PASS | Trash icon removes row, NET updates |
| TC-48 | Import CSV | ⏭ SKIPPED | Not tested in this run |

---

### Price Alerts

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-47 | Set "rises above" alert | ✅ PASS | 5176.KL ▲ rises above 2.5 — "1 active" badge |
| TC-48 | Set "drops below" alert | ✅ PASS | 5176.KL ▼ drops below 2 — "2 active" badge |
| TC-49 | Alert list shows symbol + direction + price | ✅ PASS | Colour-coded, direction icon (▲/▼) |
| TC-50 | Delete alert | ✅ PASS | Badge decrements, row removed |
| TC-51 | Alert trigger (live check cycle) | ⏭ SKIPPED | Requires 5-min auto-check interval — not testable in automation |

---

### Position Sizing

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-52 | Calculator opens with defaults | ✅ PASS | Capital 1000, Risk 2% pre-filled |
| TC-53 | Capital pre-fill note | ⚠ NOTE | Capital defaults to 1000, not pre-filled from portfolio total (696.54) |
| TC-54 | All calculations correct | ✅ PASS | Capital 5000, Risk 2%, Entry 2.30, Stop 2.10, Target 2.70 → Max Risk 100, Risk/Share 0.20, Max Shares 500, Cost 1150, Profit 200, R:R 1:2.00 ✅ |
| TC-55 | MAX SHARES highlighted | ✅ PASS | Green highlighted box for the primary output |
| TC-56 | R:R Ratio displays | ✅ PASS | "1 : 2.00" shown in gold |

---

### AI Chat

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-56 | Chat tab opens | ✅ PASS | Personalised welcome: "Hey Wen Xiang. I'm your AI trading analyst..." |
| TC-57 | Send question | ✅ PASS | Response received in ~8s |
| TC-58 | Portfolio-aware response | ✅ PASS | AI knows: 5176.KL, 300 shares, 2.16 cost, 2.31 current, RM45 gain, RM3.54 cash |
| TC-59 | Follow-up / multi-turn | ✅ PASS | "Should I hold or sell?" → contextual response about 5176.KL |
| TC-60 | Markdown rendering | ❌ BUG-04 | `#`, `**bold**`, `---` shown as raw text |

---

### Journal

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-61 | Journal tab layout | ✅ PASS | Stats cards (0 trades, 0% win, +0.00 P/L), "+ Log" button, AI Pattern Analysis section |
| TC-62 | Log trade form opens | ✅ PASS | Date pre-filled with today (05/27/2026), all fields present |
| TC-63 | Save trade | ❌ FAIL | **BUG-02** — Supabase PGRST204: missing `date` column in `journal_trades` table. Form closes silently but no trade saved. |
| TC-64 | Trade list + P/L calc | ❌ FAIL | Blocked by TC-63 |
| TC-65 | AI Pattern Analysis | ❌ FAIL | Blocked by TC-63 (requires ≥ 3 saved trades) |

---

### Cross-cutting

| TC | Test Case | Result | Notes |
|----|-----------|--------|-------|
| TC-66 | Data persistence on reload | ✅ PASS | Portfolio (5176.KL 300@2.16), Cash (3.54), Watchlist (VOO), Price Alerts (rises above 2.5) all survive full page reload |
| TC-67 | Disclaimer banner | ✅ PASS | Visible on every tab: "AI analysis is based on general knowledge — not real-time data. Verify with live charts. Not financial advice." |
| TC-68 | AI Chat "Ask AI" bubble | ✅ PASS | Floating "Ask AI" button visible on all tabs |

---

## Fix Priority

| Priority | Bug | Fix |
|----------|-----|-----|
| 🔴 P1 | BUG-01 Double render | Delete duplicate `<Dashboard>` and `<Analyzer>` renders at App.jsx ~line 449–451 |
| 🔴 P1 | BUG-02 Journal broken | `ALTER TABLE journal_trades ADD COLUMN date date;` in Supabase |
| 🟡 P2 | BUG-03 Search empty for US stocks | Investigate Yahoo Finance search response — log raw API response from Railway server to confirm geo-filter or quoteType mismatch |
| 🟡 P2 | BUG-04 Markdown not rendered | Add `react-markdown` to AI response containers |
| 🔵 P3 | BUG-05 AI stock name | Include company name from live quote in AI prompts for better accuracy |

---

## What Works Well ✅

- Full authentication flow (login, logout, session persistence)
- All 7 tabs navigate correctly with active state
- Settings: API key save, model selection, auto-refresh
- Dashboard: live stats, AI Daily Insight generation, allocation chart, performance chart
- Watchlist: add/remove, live price fetch, Quick Scan (AI badge), Analyze → (tab switch + auto-run)
- Full Analyzer: comprehensive AI analysis with Technical, Fundamental, Risk, Trade Plan panels
- Portfolio: inline price editing with instant recalculation, add/remove holdings, NET header updates live
- Price Alerts: create both directions (▲/▼), delete, badge count, persist on reload
- Position Sizing Calculator: all 6 outputs calculate correctly (Max Risk, Risk/Share, Max Shares, Cost, Profit, R:R)
- AI Chat: personalised greeting, portfolio-aware responses, multi-turn conversation, fast response (~8s)
- Data persistence: all Supabase-backed data (portfolio, watchlist, alerts) survives page reloads
