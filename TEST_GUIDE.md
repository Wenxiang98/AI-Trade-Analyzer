# AI Trade Desk — Test Guide
> App: AI Trade Analyzer · Stack: React + Vite (Vercel) · Java Spring Boot (Railway) · Supabase  
> Last updated: 2026-05-27

---

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Test passed |
| ❌ | Test failed — note what happened |
| ⚠️ | Known limitation — expected behaviour |

---

---

# SCREEN 1 — Login Screen

---

## TC-01 · Page loads correctly

**Preconditions:** Open the production Vercel URL in a fresh browser tab.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Open the app URL | Dark background (#0a0a0a) loads. No white flash. |
| 2 | Observe the page | "AI Trade Desk" title visible with green "AI" prefix |
| 3 | Observe form | Email field + Password field + "Sign In" button + "Sign Up" link visible |
| 4 | Resize to mobile (< 640px) | Layout is clean, form is centered, no overflow |

---

## TC-02 · Sign in with wrong password

**Preconditions:** Have a registered Supabase account.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Enter your email address | Field accepts input |
| 2 | Enter an incorrect password | Field accepts input |
| 3 | Click **Sign In** | Button shows spinner briefly |
| 4 | Wait for response | Red error message appears: "Invalid login credentials" (or similar) |
| 5 | Form is still visible | User can try again — not kicked out |

---

## TC-03 · Sign in with correct credentials

**Preconditions:** Have a registered Supabase account with correct password.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Enter correct email | ✓ |
| 2 | Enter correct password | ✓ |
| 3 | Click **Sign In** | Button shows spinner |
| 4 | App loads | **Dashboard** tab appears — no login screen |
| 5 | Check top-right header | Shows your email prefix (e.g. `wen.xiang`) |
| 6 | Check NET value (desktop) | Shows `RM X.XX` total assets |

---

## TC-04 · Sign out

**Preconditions:** Currently logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the **logout icon** (top-right, door-arrow icon) | — |
| 2 | Observe page | Returns to Login screen immediately |
| 3 | Sign back in | All data (portfolio, alerts, watchlist, journal) is still there |

---

---

# SCREEN 2 — Header & Navigation

---

## TC-05 · Header elements visible

**Preconditions:** Logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Look at top-left | Small green pulsing dot + "**AI** Trade Desk v1.0" |
| 2 | Look at top-right (desktop) | `NET` label + total RM value + P/L change |
| 3 | Total assets is positive | P/L shows green ▲ and green amount |
| 4 | Total assets has a loss | P/L shows red ▼ and red amount |
| 5 | Look at top-right icons | ⚙ gear icon + logout icon |

---

## TC-06 · Navigation tabs

**Preconditions:** Logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Count tabs in nav bar | 7 tabs: Dashboard, Watchlist, Analyzer, Portfolio, Sizing, AI Chat, Journal |
| 2 | Click **Dashboard** | Green underline on Dashboard tab; dashboard content shows |
| 3 | Click **Watchlist** | Green underline moves to Watchlist; watchlist content shows |
| 4 | Click **Analyzer** | Analyzer content shows |
| 5 | Click **Portfolio** | Portfolio content shows |
| 6 | Click **Sizing** | Sizing calculator shows |
| 7 | Click **AI Chat** | Chat interface shows |
| 8 | Click **Journal** | Journal shows |
| 9 | On mobile (<640px) | Tabs scroll horizontally, no wrapping |

---

## TC-07 · Floating "Ask AI" button

**Preconditions:** Logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to any tab except AI Chat | Green circular button (bottom-right): "Ask AI" with chat icon |
| 2 | Click the **Ask AI** button | Switches to AI Chat tab |
| 3 | Now on AI Chat tab | Floating button is hidden |

---

## TC-08 · Disclaimer banner

**Preconditions:** Logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Look below the nav bar | Amber-tinted banner with ⚠ icon |
| 2 | Read the text | "AI analysis is based on general knowledge — not real-time data. Verify with live charts. Not financial advice." |

---

---

# SCREEN 3 — Settings Modal

---

## TC-09 · Open settings

**Preconditions:** Logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click ⚙ gear icon (top-right) | Dark modal overlays the app |
| 2 | Observe modal content | Three sections: API Key, Claude Model selector, Auto Price Refresh |
| 3 | Click the X or outside modal | Modal closes, app resumes |

---

## TC-10 · Save Anthropic API key

**Preconditions:** Have an Anthropic API key (`sk-ant-...`). Settings modal open.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the API Key field | Field is active, shows `•••••` (password masked) |
| 2 | Paste your `sk-ant-api-key` | Input accepted |
| 3 | Click **Save Settings** | Button text changes to "✓ Saved!" briefly |
| 4 | Modal closes automatically | App continues normally |
| 5 | Re-open settings | API key field still shows masked dots (key was saved) |
| 6 | Sign out and back in | Key is auto-loaded from Supabase — no need to re-enter |

---

## TC-11 · Claude model selection

**Preconditions:** Settings modal open.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe model options | 3 options: Haiku 4.5 (green), Sonnet 4.6 (blue), Opus 4.7 (purple) |
| 2 | Click **Haiku 4.5** | Row highlights with green border |
| 3 | Click **Sonnet 4.6** | Row highlights with blue border |
| 4 | Click **Opus 4.7** | Row highlights with purple border |
| 5 | Select Haiku 4.5 → Save | All AI calls now use Haiku 4.5 (cheapest) |
| 6 | Re-open settings | Selected model is still Haiku 4.5 |

---

## TC-12 · Auto price refresh interval

**Preconditions:** Settings modal open. At least one holding in portfolio.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe refresh options | Off / 1 min / 5 min / 15 min / 30 min |
| 2 | Click **1 min** → Save | Setting saved |
| 3 | Wait 60 seconds on Portfolio tab | Prices auto-refresh — "Refreshing…" spinner briefly appears, "Checked HH:MM" timestamp updates |
| 4 | Open Settings → select **Off** → Save | Auto-refresh stops |
| 5 | Wait 2 minutes | No automatic refresh happens |

---

---

# SCREEN 4 — Dashboard

---

## TC-13 · Stats cards

**Preconditions:** Logged in with at least one holding and some cash.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Dashboard** tab | 4 stat cards visible in a row |
| 2 | Read **Total Assets** | Shows `RM X.XX` = portfolio market value + cash |
| 3 | Read **Market Value** | Shows `RM X.XX` = sum of (qty × current price) for all holdings |
| 4 | Read **Position P/L** | Shows P/L in RM + % — green if profit, red if loss |
| 5 | Read **Cash** | Shows `RM X.XX` matching what you set in Portfolio tab |
| 6 | Click **Live Prices** in Portfolio tab | Return to Dashboard — Total Assets and P/L updated |

---

## TC-14 · AI Daily Insight

**Preconditions:** API key saved. At least one holding in portfolio.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Dashboard** tab | "AI Daily Insight" panel visible with "Generate" button |
| 2 | Panel text before clicking | "Click 'Generate' for today's AI-powered market insight." |
| 3 | Click **Generate** | Spinner appears next to "Generate" button |
| 4 | Wait for AI response | 3–4 sentences of market commentary appear |
| 5 | Content is relevant | Insight references your actual holdings or their sectors |
| 6 | Click **Generate** again | New insight replaces the previous one |
| 7 | Test without API key | Error message: "API key not set. Click the gear icon to add your Anthropic API key." |

---

## TC-15 · Portfolio Performance chart

**Preconditions:** Must have clicked "Live Prices" at least twice (to have 2+ data points).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to Dashboard with no history | Panel shows: "Click 'Live Prices' a few times to start tracking performance." |
| 2 | Go to Portfolio → click **Live Prices** | Snapshot saved |
| 3 | Go to Portfolio → click **Live Prices** again | 2nd snapshot saved |
| 4 | Go to Dashboard | Line chart appears with green line |
| 5 | Hover over the chart | Tooltip shows `RM X.XX` and date label |
| 6 | X-axis | Shows dates (e.g. "May 27") |
| 7 | Y-axis | Shows `RM` amounts |

---

## TC-16 · Allocation pie chart

**Preconditions:** Holdings and/or cash present.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Dashboard** with no holdings/cash | "No holdings yet." message |
| 2 | Add a holding and some cash | Return to Dashboard |
| 3 | Observe pie chart | Donut chart with colour slices — one per holding + one for Cash |
| 4 | Hover over a slice | Tooltip shows symbol name and RM value |
| 5 | Check legend below chart | Each symbol listed with colour dot + % of total assets |

---

## TC-17 · Holdings summary on Dashboard

**Preconditions:** Holdings present.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Look at Holdings panel (bottom-right of Dashboard) | Lists all holdings with symbol, qty, avg cost, MV, P/L |
| 2 | P/L is positive | Amount shown in green |
| 3 | P/L is negative | Amount shown in red |
| 4 | Click **Manage →** link | Switches to Portfolio tab |

---

---

# SCREEN 5 — Watchlist

---

## TC-18 · Empty state

**Preconditions:** No items in watchlist yet.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Watchlist** tab | Eye icon + "No stocks on watchlist." message |
| 2 | Read the hint text | "Click + Watch to add stocks you're tracking." |

---

## TC-19 · Add a Malaysian stock to watchlist

**Preconditions:** Watchlist tab open. API key saved (backend search doesn't need it, but AI features do).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **+ Watch** button | Search box appears with blinking cursor (autofocused) |
| 2 | Type `Maybank` | After ~400ms, dropdown appears with results |
| 3 | Observe dropdown results | `1155.KL` · Malayan Banking Berhad · Kuala Lumpur Stock Exchange |
| 4 | Click the `1155.KL` result | Item added to watchlist; search box closes |
| 5 | Watchlist shows the item | `1155.KL  Malayan Banking Berhad  KLSE` with loading spinner for price |
| 6 | Price loads | `MYR X.XX` with `+X.XX%` or `-X.XX%` change |

---

## TC-20 · Add a US stock to watchlist

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **+ Watch** | Search box opens |
| 2 | Type `apple` | Dropdown shows `AAPL`, `Apple Inc`, `NASDAQ` |
| 3 | Click AAPL result | Added to watchlist |
| 4 | Price loads | `USD XXX.XX` with daily change % |

---

## TC-21 · Add duplicate — no duplicate created

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Try to add a stock already in your watchlist | Search → click same symbol |
| 2 | Observe watchlist | Only one entry for that symbol (no duplicate) |

---

## TC-22 · Refresh prices

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Watchlist has items with prices loaded | Visible |
| 2 | Click **Refresh** button (top-right of Watchlist panel) | Spinner appears on the button |
| 3 | Prices update | New prices shown (may be same if market hasn't moved) |

---

## TC-23 · Quick Scan — AI verdict

**Preconditions:** API key saved. Watchlist has at least one item.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Locate a watchlist item with no scan yet | **Scan** button visible on the right |
| 2 | Click **Scan** | Spinner appears |
| 3 | Wait for result | Coloured badge appears: `BUY` (green) / `HOLD` (amber) / `SELL` (red) |
| 4 | Below the row | Short one-sentence reason (e.g. "Strong uptrend supported by volume") |
| 5 | Scan a second item | Each item can have its own independent scan result |

---

## TC-24 · Analyze → (launch full analysis)

**Preconditions:** Watchlist has items.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Find any watchlist item | Locate **Analyze →** button (blue) |
| 2 | Click **Analyze →** | App switches to **Analyzer** tab automatically |
| 3 | Analyzer tab | Analysis runs immediately — no need to type or search |
| 4 | Full analysis panels appear | Ticker, verdict, technical, fundamental, risks, trade plan all visible |

---

## TC-25 · Add watchlist item directly to Portfolio

**Preconditions:** Watchlist has items with prices loaded.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Find any watchlist item | Locate **+ Port** button (green-outlined) |
| 2 | Click **+ Port** | Row expands downward with Qty + Avg Cost input fields |
| 3 | Avg Cost field | Pre-filled with current live price |
| 4 | Change Avg Cost to `2.16` | Field accepts new value |
| 5 | Fill Qty: `300` | ✓ |
| 6 | Click **Confirm** | Holding added to Portfolio; form collapses |
| 7 | Go to **Portfolio** tab | New holding `[SYMBOL]  300  2.16` visible in table |
| 8 | Click Cancel instead | Form collapses; nothing added |

---

## TC-26 · Remove from watchlist

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Find any watchlist item | Trash 🗑 icon on the far right |
| 2 | Click the trash icon | Item removed from list immediately |
| 3 | Refresh the page | Item is gone (confirmed deleted from Supabase) |

---

## TC-27 · Watchlist persists across sessions

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Add 2–3 stocks to watchlist | ✓ |
| 2 | Sign out | ✓ |
| 3 | Sign back in → go to Watchlist | All previously added stocks still there |

---

---

# SCREEN 6 — Analyzer

---

## TC-28 · Empty state / example chips

**Preconditions:** Analyzer tab open, no search done yet.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Analyzer** tab | Search bar + hint text visible |
| 2 | Hint text | "💡 Examples: VOO · apple · tech etf · malaysia bank" |
| 3 | Bottom of screen | Example quick-chips: `VOO`, `SPY`, `AAPL`, `5176.KL`, `tech etf`, `malaysia bank` |
| 4 | Also shows | "💬 For free-form questions, use the AI Chat tab" |

---

## TC-29 · Search by exact ticker (US ETF)

**Preconditions:** API key saved.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Type `VOO` in search box | ✓ |
| 2 | Press **Enter** or click **Search** | "Searching" spinner |
| 3 | Fetches live price | Price pulled from Twelve Data (USD) |
| 4 | Analysis builds | "Running analysis..." spinner appears |
| 5 | Result appears | Full structured analysis panels load |
| 6 | Header panel | Shows `VOO  Vanguard S&P 500 ETF  USD XXX.XX · live` + verdict |

---

## TC-30 · Search by company name

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Type `apple` → Search | AI resolves to `AAPL` automatically |
| 2 | Full analysis appears | Ticker shows `AAPL`, name `Apple Inc`, price in USD |

---

## TC-31 · Search by keyword (multiple suggestions)

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Type `tech etf` → Search | "No exact match. Did you mean:" panel appears |
| 2 | Suggestions listed | 3–5 ETFs with ticker, name, market |
| 3 | Click any suggestion | Full analysis runs for that ticker |

---

## TC-32 · Search Bursa Malaysia stock

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Type `5176.KL` → Search | Fetches live MYR price from Yahoo Finance |
| 2 | Analysis appears | Price shown in MYR (e.g. `MYR 2.31 · live`) |
| 3 | Type `malaysia bank` → Search | AI suggests `1155.KL`, `1023.KL`, `1295.KL` etc. |

---

## TC-33 · Quick-example chips

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the `VOO` chip | Auto-searches VOO immediately |
| 2 | Click `5176.KL` chip | Auto-searches Sunway REIT |
| 3 | Click `malaysia bank` chip | Shows suggestions for Malaysian banks |

---

## TC-34 · Analysis result panels

**Preconditions:** Successful analysis completed (e.g. VOO).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | **Header panel** | Ticker code, full name, market, sector visible |
| 2 | Live price | `USD XXX.XX · live` in green with "live" label |
| 3 | Verdict | Large bold text: `BUY` (green) / `HOLD` (amber) / `SELL` (red) |
| 4 | Confidence | `/10` score below verdict |
| 5 | Summary | 2-sentence overview referencing the current price |
| 6 | **Technical panel** | Trend, Momentum, Support level, Resistance level |
| 7 | **Fundamental panel** | 2-sentence fundamental analysis |
| 8 | **Risks panel** | 3 bullet-point risks (amber coloured) |
| 9 | **AI Trade Plan panel** | Entry Zone, Stop Loss (red), Target (green), Position Size (RM), Rationale |

---

## TC-35 · Position size in Trade Plan

**Preconditions:** Capital set to e.g. RM 10,000 in Sizing tab.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Run analysis on any stock | Trade Plan panel appears |
| 2 | Check Position Size field | Shows `RM XXXX` based on your capital at 2% risk |
| 3 | Change Capital in Sizing tab to RM 20,000 | Re-run analysis — Position Size now reflects new capital |

---

## TC-36 · Reset / clear analysis

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | After analysis is shown | X button appears next to Search button |
| 2 | Click the X button | All analysis panels cleared |
| 3 | Search bar | Empty and ready for new search |

---

## TC-37 · Analyzer launched from Watchlist

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to Watchlist → click **Analyze →** on any item | ✓ |
| 2 | Analyzer tab activates | Tab switches automatically |
| 3 | Analysis runs without any user input | Full result appears automatically |

---

---

# SCREEN 7 — Portfolio

---

## TC-38 · Empty state

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | No holdings in portfolio | "No holdings. Add manually or import from MOOMOO CSV." |

---

## TC-39 · Add holding manually with symbol search

**Preconditions:** Portfolio tab open.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Add** button (top-right) | Form expands below the toolbar |
| 2 | Click the symbol search field | Autofocused with search icon |
| 3 | Type `SUNREIT` | After ~400ms, dropdown shows: `5176.KL  Sunway Real Estate...` |
| 4 | Click the dropdown result | Symbol field filled as `5176.KL`; live price auto-fetches |
| 5 | Current Price field | Auto-filled with the fetched live price (e.g. `2.31`) |
| 6 | Fill **Qty**: `300` | ✓ |
| 7 | Fill **Avg Cost**: `2.16` | ✓ |
| 8 | Click **Save** | Holding added to table; form closes |
| 9 | Holding visible | `5176.KL  300  2.16  2.31  693.00  +45.00 (+6.9%)` |

---

## TC-40 · Add US ETF manually

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Add** → type `VOO` in symbol search | Dropdown shows VOO |
| 2 | Click VOO | Current price fetched in USD |
| 3 | Fill qty + avg cost → Save | Holding appears with USD price |

---

## TC-41 · Holdings table columns

**Preconditions:** At least one holding in portfolio.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Read column headers | Symbol / Qty / Cost / Current / MV / P/L / (delete) |
| 2 | MV column | = Qty × Current price |
| 3 | P/L column (profit) | Green, e.g. `+45.00 (+6.9%)` |
| 4 | P/L column (loss) | Red, e.g. `-30.00 (-3.2%)` |

---

## TC-42 · Manually edit current price

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the **Current** price cell of any holding | Field becomes editable (number input) |
| 2 | Change the price (e.g. `2.50`) | MV and P/L recalculate immediately in the row |
| 3 | Click somewhere else (blur) | Price saved to Supabase silently |
| 4 | Refresh the page | New price persists |

---

## TC-43 · Remove a holding

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the 🗑 trash icon on any row | Holding disappears from table |
| 2 | Refresh page | Holding is gone (deleted from Supabase) |
| 3 | Dashboard updates | Removed holding no longer in pie chart or stats |

---

## TC-44 · Live Prices button

**Preconditions:** At least one holding in portfolio.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Live Prices** button | Spinner + "Refreshing…" text appears on button |
| 2 | While refreshing | Button is disabled; cannot click again |
| 3 | After refresh completes | Current price column updated with live prices |
| 4 | MV and P/L columns | Recalculate based on new prices |
| 5 | Header NET value | Updates immediately |
| 6 | Dashboard performance chart | New data point added |
| 7 | Price Alerts | Checked against new prices — any triggers fire |

---

## TC-45 · Cash field

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Locate **CASH (RM)** input above holdings table | Small number field |
| 2 | Change value to `5000` | Header "Total Assets" updates immediately |
| 3 | Wait ~1 second | Cash auto-saved to Supabase (debounced, no button needed) |
| 4 | Sign out and back in | Cash shows `5000.00` |

---

## TC-46 · CSV import from MOOMOO

**Preconditions:** Have a CSV file exported from MOOMOO app.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Import CSV** button | File picker dialog opens |
| 2 | Select a valid MOOMOO CSV file | File is read |
| 3 | Preview panel appears | Blue panel: "Found X holdings — this will replace your current portfolio." |
| 4 | Preview lists holdings | Each line: `SYMBOL · qty X · cost X.XX` |
| 5 | Click **Cancel** | Preview dismissed; current portfolio unchanged |
| 6 | Re-import → click **Confirm Import** | All current holdings replaced with CSV data |
| 7 | Holdings table | Shows all rows from CSV |
| 8 | Click **Live Prices** after import | Prices fetched for all imported symbols |
| 9 | Invalid CSV file | Error message: "Could not find Symbol / Qty / Avg Cost columns." |

---

---

# SCREEN 8 — Price Alerts (inside Portfolio tab)

---

## TC-47 · Add a price alert

**Preconditions:** Portfolio tab open. Scroll to "Price Alerts" panel below holdings table.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Fill **Symbol**: `SUNREIT` (or `5176.KL`) | ✓ |
| 2 | Leave direction as **rises above** | ✓ |
| 3 | Fill **Price**: `2.50` | ✓ |
| 4 | Click **Set Alert** | Alert appears in list: `SUNREIT ▲ rises above 2.50` |
| 5 | Refresh page | Alert still there |
| 6 | Badge shows `X active` | Count of non-triggered alerts |

---

## TC-48 · Add a drop-below alert

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Fill Symbol: `AAPL` | ✓ |
| 2 | Change direction dropdown to **drops below** | ✓ |
| 3 | Fill Price: `150` | ✓ |
| 4 | Click **Set Alert** | Shows: `AAPL ▼ drops below 150` |

---

## TC-49 · Delete an alert

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click 🗑 trash on any active alert | Alert removed from list |
| 2 | Refresh page | Alert gone (deleted from Supabase) |

---

## TC-50 · Alert triggers on price refresh

**Preconditions:** Set an alert at a price already surpassed (e.g. symbol at 2.31, alert set at "rises above 2.00").

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Set alert: `SUNREIT rises above 2.00` | ✓ |
| 2 | Click **Live Prices** | Prices refresh; SUNREIT price is 2.31 (above 2.00) |
| 3 | Amber notification banner appears | "🔔 **SUNREIT** hit your target — now 2.31 (▲ 2.00)" |
| 4 | Alert in list | Shows "✓ triggered" green badge; row is greyed out |
| 5 | Click X on the banner | Banner dismissed |

---

## TC-51 · Last checked timestamp

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Before any refresh | "Checked HH:MM" is absent or shows old time |
| 2 | Click **Live Prices** | "Checked HH:MM" updates to current time (e.g. "Checked 03:45 PM") |

---

---

# SCREEN 9 — Position Sizing Calculator

---

## TC-52 · Default values load

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Sizing** tab | Capital and Risk % pre-filled from your saved settings |
| 2 | Default risk | 2% |

---

## TC-53 · Basic calculation

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Set Capital: `10000` | ✓ |
| 2 | Set Risk: `2` | ✓ |
| 3 | Set Entry: `2.30` | ✓ |
| 4 | Set Stop Loss: `2.15` | ✓ |
| 5 | **Max Risk (RM)** | `200.00` (10000 × 2%) |
| 6 | **Risk per Share** | `0.15` (2.30 − 2.15) |
| 7 | **Max Shares** | `1333` (floor(200 ÷ 0.15)) |
| 8 | **Position Cost** | `3065.90` (1333 × 2.30) |

---

## TC-54 · With target price (R:R ratio)

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Set Target: `2.60` (continuing from TC-53) | ✓ |
| 2 | **Potential Profit** | `399.90` (1333 × 0.30) |
| 3 | **R:R Ratio** | `1 : 2.00` (0.30 ÷ 0.15) — shown in green |
| 4 | Set Target: `2.40` (below 2× risk) | R:R = `0.67` |
| 5 | Amber warning appears | "⚠ R:R below 1:2 — consider skipping. Pro traders require 1:2 minimum." |

---

## TC-55 · Settings persist

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Change Capital to `50000`, Risk to `1.5` | ✓ |
| 2 | Switch to another tab and back | Values retained |
| 3 | Refresh page | Capital = `50000`, Risk = `1.5` (saved in localStorage) |

---

---

# SCREEN 10 — AI Chat

---

## TC-56 · Initial greeting

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **AI Chat** tab | Chat window with one message from AI |
| 2 | First message text | "Hey [username]. I'm your AI trading analyst. I know your portfolio and capital. Ask me anything..." |

---

## TC-57 · Send a message

**Preconditions:** API key saved.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Type `hello` in input box | ✓ |
| 2 | Press **Enter** | Message appears on right (green bubble) |
| 3 | Loading state | Spinner bubble appears on left |
| 4 | AI replies | Text response in dark bubble on left |
| 5 | Chat auto-scrolls | Always shows latest message |
| 6 | Click **Send** button | Same as pressing Enter |

---

## TC-58 · Portfolio-aware responses

**Preconditions:** Holdings in portfolio. API key saved.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Ask: `"What do you think of my portfolio?"` | AI references your actual holdings by symbol |
| 2 | Ask: `"My SUNREIT is down, should I hold?"` | AI knows your avg cost and can give relevant advice |
| 3 | Ask: `"How much capital do I have?"` | AI states your actual capital amount |

---

## TC-59 · Sample questions that should work

| Question | Expected |
|----------|----------|
| `"Is now a good time to buy VOO?"` | Gives a view on VOO with reasoning |
| `"What is dollar cost averaging?"` | Clear explanation |
| `"What is a stop loss and why should I use one?"` | Practical explanation |
| `"Explain RSI to me"` | Technical indicator explanation |
| `"What's the difference between ETF and stock?"` | Clear comparison |

---

## TC-60 · No API key

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Remove API key from settings | ✓ |
| 2 | Send any message | AI responds with error: "API key not set. Click the gear icon to add your Anthropic API key." |

---

---

# SCREEN 11 — Journal

---

## TC-61 · Stats row (empty)

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Journal** tab with no trades | Total Trades: `0`, Win Rate: `0%`, Total P/L: `0.00` |

---

## TC-62 · Log a winning trade

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Log** button | Form expands |
| 2 | Date: today's date | Pre-filled with today |
| 3 | Symbol: `SUNREIT` | ✓ |
| 4 | Entry: `2.10` | ✓ |
| 5 | Exit: `2.35` | ✓ |
| 6 | Qty: `300` | ✓ |
| 7 | Notes: `"Breakout above resistance"` | ✓ |
| 8 | Click **Save Trade** | Trade saved; form closes |
| 9 | Trade appears in list | `SUNREIT  [date]  300 @ 2.10 → 2.35  +75.00` (green) |
| 10 | Stats update | Total Trades: 1, Win Rate: 100%, Total P/L: +75.00 (green) |
| 11 | Refresh page | Trade still there (saved to Supabase) |

---

## TC-63 · Log a losing trade

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Log a trade: Symbol `AAPL`, Entry `180`, Exit `170`, Qty `10` | ✓ |
| 2 | P/L calculated | `(170 − 180) × 10 = −100.00` |
| 3 | Trade appears in list | `-100.00` shown in red |
| 4 | Stats update | Win Rate drops; Total P/L reflects both trades |

---

## TC-64 · Delete a trade

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click 🗑 on any trade entry | Trade removed from list |
| 2 | Stats recalculate | Total Trades, Win Rate, P/L update |
| 3 | Refresh page | Trade gone (deleted from Supabase) |

---

## TC-65 · AI Pattern Analysis

**Preconditions:** 3 or more trades logged.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Scroll to **AI Pattern Analysis** panel | "Analyze" button visible |
| 2 | Click **Analyze** with < 3 trades | Message: "Need at least 3 trades to analyze patterns." |
| 3 | Ensure 3+ trades → click **Analyze** | Spinner appears |
| 4 | AI response appears | 3 behavioural patterns + 2 improvement suggestions |
| 5 | Content is specific | References your actual symbols, entry/exit prices, win/loss patterns |
| 6 | No API key | Error message shown |

---

---

# CROSS-CUTTING TESTS

---

## TC-66 · Data persistence across sign out / sign in

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Add 2 holdings, 1 alert, 2 journal trades, 2 watchlist items | ✓ |
| 2 | Set cash to `3000` | ✓ |
| 3 | Sign out | Login screen appears |
| 4 | Sign back in | All data restored exactly as left |

---

## TC-67 · Data isolation — per user

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Log in as User A — add a holding | ✓ |
| 2 | Open incognito tab — log in as User B | User B sees empty portfolio |
| 3 | User B cannot see User A's data | ✓ (RLS enforced in Supabase) |

---

## TC-68 · Live price coverage

| Symbol | Market | Data Source | Expected |
|--------|--------|-------------|----------|
| `VOO` | US ETF | Twelve Data | USD price, daily change |
| `SPY` | US ETF | Twelve Data | USD price |
| `AAPL` | US stock | Twelve Data | USD price |
| `5176.KL` | Bursa Malaysia | Yahoo Finance | MYR price |
| `1155.KL` | Bursa Malaysia | Yahoo Finance | MYR price |
| `SUNREIT` | Bursa (alias) | Yahoo Finance | Auto-mapped to 5176.KL, MYR price |
| `MAYBANK` | Bursa (alias) | Yahoo Finance | Auto-mapped to 1155.KL, MYR price |
| `XXXXXX` | Unknown | — | Returns null / no price — no crash |

---

---

# KNOWN LIMITATIONS

> These are not bugs. Note them so you don't raise false failures.

| # | Limitation | Expected Behaviour |
|---|-----------|-------------------|
| L-01 | Price alerts are NOT real-time | Alerts only check when "Live Prices" is clicked or auto-refresh fires |
| L-02 | AI knowledge cutoff | Fundamentals are based on training data, not today's news. Live price is injected but news/events may be outdated |
| L-03 | Yahoo Finance 401 | Crumb expires occasionally; app retries once automatically. If it fails again, wait 5 min and retry |
| L-04 | Twelve Data free tier | 800 req/day. US prices fail temporarily if limit is hit. Resets at midnight UTC |
| L-05 | MOOMOO CSV import replaces ALL holdings | There is no merge — all existing holdings are deleted then replaced. Export before importing |
| L-06 | Journal P/L | Assumes all qty sold at exit price. No partial fill support |
| L-07 | Performance chart needs 2+ data points | Must click "Live Prices" at least twice before chart appears |
| L-08 | Settings (capital, risk, model) are per-device | Stored in localStorage — not synced across devices |
| L-09 | Auto-refresh background only | No push notifications when app is closed |

---

---

# QUICK SMOKE TEST (run after every deploy)

Run these 13 steps to confirm nothing is broken after a code update:

| # | Step | Expected |
|---|------|----------|
| 1 | Open app URL | Login screen loads |
| 2 | Sign in with correct credentials | Dashboard loads |
| 3 | ⚙ Settings → paste API key → Save | "✓ Saved!" |
| 4 | Dashboard → Generate | AI insight appears |
| 5 | Portfolio → Add → search `VOO` → select → qty `10`, cost `500` → Save | Holding in table |
| 6 | Portfolio → Live Prices | Prices update; MV recalculates |
| 7 | Watchlist → + Watch → type `apple` → click AAPL | AAPL in watchlist with USD price |
| 8 | Watchlist → Scan | BUY/HOLD/SELL badge appears |
| 9 | Watchlist → Analyze → | Switches to Analyzer, full analysis auto-runs |
| 10 | Sizing → Entry `2.30`, Stop `2.15`, Target `2.60` | Max Shares calculated; R:R shown |
| 11 | AI Chat → type `hello` → send | Claude replies |
| 12 | Journal → Log → fill all fields → Save Trade | Trade appears with correct P/L |
| 13 | Logout icon | Returns to login screen |

---

*AI Trade Desk · Built for Wen Xiang · Not financial advice*
