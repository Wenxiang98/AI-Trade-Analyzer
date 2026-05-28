# AI Trade Desk — Test Guide V2
> Continues from TEST_GUIDE.md (TC-01 → TC-68). New features added in Session 2.  
> App: https://wx-trade-analyzer.vercel.app/ · Stack: React + Vite (Vercel) · Java Spring Boot (Railway) · Supabase  
> Last updated: 2026-05-28

---

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Test passed |
| ❌ | Test failed — note what happened |
| ⚠️ | Known limitation — expected behaviour |

---

---

# SCREEN 4 (UPDATED) — Dashboard

---

## TC-69 · USD/MYR live FX stat card

**Preconditions:** Logged in. App just loaded.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Dashboard** tab | 4 stat cards row visible |
| 2 | Check 4th stat card | Label: **USD / MYR** · Sub: "Live FX rate" |
| 3 | Value | Shows live rate e.g. `4.41` — NOT the hardcoded `4.40` fallback (unless network error) |
| 4 | Total Assets / Market Value / P/L cards | All expressed in **RM** — US holdings are converted at this live rate |
| 5 | Disable network → reload | 4th card falls back to `4.40` (no crash) |

---

## TC-70 · vs Benchmark panel (1 Month)

**Preconditions:** Logged in.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Scroll to bottom of Dashboard | Panel titled "vs Benchmark (1 Month)" visible |
| 2 | While fetching | VOO and SPY tiles show a small spinner |
| 3 | After data loads | Three tiles: **Your Portfolio**, **VOO**, **SPY** |
| 4 | Your Portfolio tile | Shows unrealised % (e.g. `+6.43%`) — green if positive, red if negative |
| 5 | VOO tile | Shows 1M % return for VOO (e.g. `+2.11%`) |
| 6 | SPY tile | Shows 1M % return for SPY (similar to VOO) |
| 7 | Sub-labels | Portfolio → "unrealised" · VOO → "S&P 500 ETF" · SPY → "S&P 500 ETF" |
| 8 | No holdings | Portfolio tile shows `—` — no crash |

---

## TC-71 · Holdings panel shows dual currency for US stocks

**Preconditions:** At least one US holding (e.g. VOO) and one MYR holding (e.g. 5176.KL) in portfolio.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to Dashboard → Holdings panel | List of holdings visible |
| 2 | Inspect a US holding (non .KL) | Primary line: `RM XXX.XX` (converted); secondary tiny line: `$XXX.XX` (USD) below |
| 3 | Inspect a Bursa holding (.KL) | Shows only `RM XXX.XX` — no secondary USD line |
| 4 | P/L column | Both show RM amounts |

---

---

# SCREEN 5 (UPDATED) — Watchlist — Tags

---

## TC-72 · Add a tag to a watchlist item

**Preconditions:** At least one item in the watchlist.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Watchlist** tab | Items listed — each row has a small tag button on the left section |
| 2 | Locate the tag button | Shows a small 🏷 icon if no tag, or the existing tag text (amber) |
| 3 | Click the tag button on any item | Inline input field appears (amber border, w-20) |
| 4 | Type `REIT` → press **Enter** | Tag saved; input closes; amber badge `REIT` appears on the row |
| 5 | Refresh the page | Tag is still there (saved in localStorage) |
| 6 | Sign out and back in | Tag persists (localStorage, not user-specific — device only) |

---

## TC-73 · Edit / remove a tag

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the existing amber tag badge on a row | Inline input opens with current tag pre-filled |
| 2 | Clear the input → press **Enter** | Tag removed; icon reverts to 🏷 |
| 3 | Click tag → type `ETF` → press **Escape** | Input closes; original tag remains (Escape cancels) |
| 4 | Click tag → blur (click elsewhere) | Tag saves with whatever was typed |

---

## TC-74 · Tag filter bar appears

**Preconditions:** At least two items tagged with different labels.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Tag one item `REIT`, another `US ETF` | ✓ |
| 2 | Observe Watchlist panel header area | Tag filter bar appears with: 🏷 icon · **All** button · `REIT` chip · `US ETF` chip |
| 3 | No tags exist yet | Filter bar is not shown |

---

## TC-75 · Filter watchlist by tag

**Preconditions:** Multiple items with different tags (TC-72/74 complete).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click the `REIT` filter chip | Only items tagged `REIT` are visible |
| 2 | Click `REIT` again (toggle off) | Reverts to showing all items |
| 3 | Click `All` button | All items visible regardless of tags |
| 4 | Items without tag | Hidden when a specific tag filter is active |

---

---

# SCREEN 6 (UPDATED) — Analyzer

---

## TC-76 · News panel appears after analysis

**Preconditions:** API key saved. Run any analysis (e.g. VOO).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Search and run analysis for **AAPL** | Full analysis panels load |
| 2 | Scroll down past the chart | **Latest News** panel visible with 🗞 newspaper icon |
| 3 | Loading state | "Loading headlines..." spinner shows while fetching |
| 4 | After load | Up to 5 news items listed |
| 5 | Each item | Title (clickable link), publisher name, relative time (e.g. `3h ago`, `2d ago`) |
| 6 | Click a headline | Opens in new tab (rel="noopener noreferrer") |
| 7 | No news returned | News panel is hidden entirely (not an error) |

---

## TC-77 · News panel for Bursa stock

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Search `5176.KL` (Sunway REIT) | Analysis runs |
| 2 | Scroll to News panel | News headlines load — some may be in Malay or English |
| 3 | Publisher column | Shows source name (e.g. "The Edge Markets") |

---

## TC-78 · Chart zoom-out fix — no blank space to the left

**Preconditions:** Run any analysis to load a chart.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Chart loads with default 6M range | Candles fill the chart area |
| 2 | Scroll the mouse wheel outward (zoom out) | Candles shrink — chart shows more of the available data |
| 3 | Zoom out to maximum | Left edge stops at the **first candle** — no blank empty space to the left |
| 4 | Before fix | Zooming out would scroll into empty history — no candles visible on left side |
| 5 | Change range to **5Y** | Chart reloads with 5 years of data; zooming out again clamps to first candle |
| 6 | Resize browser window | Visible candles stay the same (lockVisibleTimeRangeOnResize) |

---

---

# SCREEN 7 (UPDATED) — Portfolio

---

## TC-79 · Print button

**Preconditions:** Portfolio tab open.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Locate the **Print** button in toolbar (printer icon, top-right area) | Button visible between Import CSV and Live Prices |
| 2 | Click **Print** | Browser print dialog opens (or native print preview) |
| 3 | Print preview shows | Portfolio table and all visible content present |
| 4 | Cancel print | App returns to normal state |
| 5 | Mobile: button text hidden, icon visible | Only printer icon shown on small screens |

---

---

# SCREEN 9 (UPDATED) — Position Sizing Calculator

---

## TC-80 · Brokerage cost input

**Preconditions:** Sizing tab open. Entry and Stop Loss filled.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe the **Brokerage (% per side)** field | Default value: `0.10` |
| 2 | Fill Entry: `2.30`, Stop: `2.15`, Target: `2.60` | Calculations appear |
| 3 | **Transaction Costs** breakdown panel appears | Shows: Brokerage (buy), Brokerage (sell), Stamp duty (buy), Stamp duty (sell) |
| 4 | Change brokerage to `0.08` | Brokerage cost rows update in real-time |
| 5 | Change brokerage to `0.00` | Brokerage lines show RM 0.00 |

---

## TC-81 · Stamp duty toggle (Bursa)

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe **Stamp duty** checkbox | Default: checked (on) |
| 2 | With stamp duty ON | Two stamp duty rows (buy + sell) shown in amber |
| 3 | Uncheck the checkbox | Stamp duty rows disappear from the cost breakdown |
| 4 | Total Costs row | Drops when stamp duty is unchecked |

---

## TC-82 · Break-even price

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Fill Entry: `2.30`, Stop: `2.15`, Target: `2.60`, Brokerage: `0.10` | Calculations visible |
| 2 | **Break-even Price** field | Shows a price *above* entry (e.g. `RM 2.311`) — amount needed to cover round-trip costs |
| 3 | Set brokerage to `0.00` and uncheck stamp duty | Break-even = entry price exactly |

---

## TC-83 · Net profit after costs

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Fill all fields including Target | **Net Profit (after costs)** shows gross profit minus total transaction costs |
| 2 | Net profit is positive | Green |
| 3 | Net profit turns negative (brokerage too high vs profit) | Red |

---

---

# SCREEN 11 (UPDATED) — Journal

---

## TC-84 · Equity curve appears with 2+ trades

**Preconditions:** At least 2 trades logged in Journal.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Go to **Journal** tab | **Equity Curve** panel visible above P&L Calendar (only when 2+ trades exist) |
| 2 | Chart type | Line chart with cumulative P/L on Y-axis |
| 3 | X-axis labels | Short date labels (MM-DD format) |
| 4 | With only 1 trade | Equity curve panel is NOT shown |
| 5 | Overall P/L is positive | Line color is green |
| 6 | Overall P/L is negative | Line color is red |
| 7 | Hover tooltip | Shows "Cumulative P/L: RM +XX.XX" |

---

## TC-85 · P&L Calendar navigation

**Preconditions:** Journal tab open. At least one trade logged.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Scroll to **P&L Calendar** panel | Monthly grid visible with `‹` and `›` nav buttons |
| 2 | Click `›` (next month) | Calendar advances to next month |
| 3 | Click `‹` (prev month) | Returns to current month |
| 4 | Month label | Shows e.g. "May 2026" |
| 5 | Day-of-week headers | Sun Mon Tue Wed Thu Fri Sat |

---

## TC-86 · P&L Calendar shows trade P/L colours

**Preconditions:** Log a winning trade on today's date. Log a losing trade on yesterday.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe the day with winning trade | Cell is **green-tinted** with day number and small `+XX` amount |
| 2 | Observe the day with losing trade | Cell is **red-tinted** with day number and small `-XX` amount |
| 3 | Days with no trades | Plain dark background, dim day number |
| 4 | Two trades on same day | P/L summed — single colour tile for net |
| 5 | Legend at bottom | "■ Profit day" (green) · "■ Loss day" (red) |

---

## TC-87 · P&L Calendar read-only

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click any day cell in the P&L Calendar | Nothing happens — calendar is display-only |
| 2 | No input form appears | Calendar is derived from journal trades, not independently editable |

---

---

# SCREEN 12 — Dividends (New Tab)

---

## TC-88 · Tab exists and loads

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Dividends** tab in nav | Tab highlights; Dividend Tracker screen loads |
| 2 | Top stat cards visible | Tracked · Est. Annual Income · Paying Dividends |
| 3 | Auto-fetch begins on load | Spinner appears briefly while fetching dividend data |

---

## TC-89 · Stat cards

**Preconditions:** At least 2 holdings + 1 watchlist item.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | **Tracked** card | Count = unique symbols across portfolio + watchlist |
| 2 | **Est. Annual Income** | RM amount = sum of (divRate × qty × FX) for all portfolio holdings that pay dividends |
| 3 | **Paying Dividends** card | Count of symbols where divRate > 0 |
| 4 | No dividends found | Est. Annual Income = RM 0.00 |

---

## TC-90 · Dividend table columns and data

**Preconditions:** Holdings with dividend-paying stocks (e.g. 1155.KL Maybank, VOO).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Table headers | Symbol · Price · Div / Share · Yield · Ex-Date · Est. Annual Income |
| 2 | Bursa stock (e.g. 1155.KL) | Div/Share: `RM X.XXXX`, Price: `RM X.XX` |
| 3 | US ETF (e.g. VOO) | Div/Share: `$X.XXXX`, Price: `$XXX.XX` |
| 4 | Yield column | Green if > 0%, e.g. `4.25%`. Shows `—` if no yield data |
| 5 | Est. Annual Income | Shows `RM XX.XX` only for portfolio holdings with qty > 0 |
| 6 | Watchlist-only items | Qty label shows "watchlist"; Income column shows `—` |
| 7 | Stocks that don't pay dividends | Div/Share and Yield both show `—` |

---

## TC-91 · Upcoming ex-dividend date highlight

**Preconditions:** Any stock with a future ex-dividend date.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Find a row with an ex-date in the future | Ex-Date column shows date + amber **●** dot beside it |
| 2 | Past ex-date | Shown in dim colour, no dot |
| 3 | No ex-date data | Shows `—` |

---

## TC-92 · Refresh button

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Refresh** button (top-right of panel) | Spinner appears on button |
| 2 | After refresh | Table data updated; new request sent to backend |

---

## TC-93 · Footer disclaimer

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Scroll to bottom of dividend table | Footer text: "Dividend data is trailing 12-month. Upcoming ex-dates marked ●. US dividends converted at X.XX USD/MYR." |
| 2 | FX rate in footer | Matches live USD/MYR rate shown on Dashboard |

---

---

# SCREEN 13 — Screener (New Tab)

---

## TC-94 · Tab exists and shows empty state

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Screener** tab | Screen loads with filter controls and empty state |
| 2 | Empty state message | "Select a universe and click Scan" with sub-text about data fields |
| 3 | **Scan** button | Green, not loading |
| 4 | No auto-load on tab open | User must click Scan manually |

---

## TC-95 · Universe selector

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe Universe button group | **Top 26** · Portfolio · Watchlist · All |
| 2 | Default selection | **Top 26** (blue highlight) |
| 3 | Click **Portfolio** | Only your portfolio holdings will be scanned |
| 4 | Click **Watchlist** | Only watchlist symbols scanned |
| 5 | Click **All** | Preset universe + portfolio + watchlist (deduplicated) |

---

## TC-96 · Scan preset universe

**Preconditions:** Click Screener tab, keep Universe = Top 26.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Scan** | Button text changes to "Scanning…" + spinner |
| 2 | Results load | Table appears with up to 26 rows |
| 3 | Columns | Symbol · Price · Chg % · Yield % · P/E · Mkt Cap · 52W Pos (desktop) · Volume (large screens) |
| 4 | Bursa symbols | Price prefixed `RM` |
| 5 | US symbols | Price prefixed `$` |
| 6 | Chg % positive | Green |
| 7 | Chg % negative | Red |
| 8 | Footer count | "X of Y results · 52W Pos = % position in 52-week range · click headers to sort" |

---

## TC-97 · Column sorting

**Preconditions:** Screener results loaded.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Chg %** header | Sorts descending (default) — best movers first |
| 2 | Click **Chg %** again | Sorts ascending — worst movers first |
| 3 | Click **Yield %** header | Sorted by dividend yield descending |
| 4 | Click **P/E** header | Sorted by P/E ratio |
| 5 | Active sort column | Header text becomes brighter + shows ↑ or ↓ arrow |

---

## TC-98 · Market filter

**Preconditions:** Screener results loaded with preset universe (contains both Bursa + US symbols).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Default | All markets shown |
| 2 | Click **Bursa** | Only `.KL` symbols visible in table |
| 3 | Click **US** | Only non-`.KL` symbols visible |
| 4 | Click **All** | Both markets shown again |

---

## TC-99 · Numeric filters

**Preconditions:** Screener results loaded.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Type `3` in **Min Yield %** | Only stocks with divYield ≥ 3% shown |
| 2 | Clear Min Yield; type `20` in **Max P/E** | Only stocks with P/E ≤ 20 shown (or P/E unknown) |
| 3 | Type `-5` in **Min Change %** | Only stocks that dropped 5%+ are hidden (shows ≥ -5%) |
| 4 | Combine filters | E.g. Bursa + Min Yield 3 → only Bursa stocks yielding ≥ 3% |
| 5 | All filtered out | "No stocks match your filters." message |

---

## TC-100 · 52W Position bar

**Preconditions:** Screener loaded, medium/large screen.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Look at **52W Pos** column (hidden on mobile) | Small bar chart showing position in 52-week range |
| 2 | Stock near 52-week high (>70%) | Bar is green and mostly filled |
| 3 | Stock near 52-week low (<30%) | Bar is red and mostly empty |
| 4 | Stock in middle range | Bar is amber |
| 5 | % number | Right-aligned, e.g. `83%` |

---

---

# SCREEN 14 — Options Calculator (New Tab)

---

## TC-101 · Tab exists and shows empty state

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Options** tab | Screen loads with "Options Calculator — Black-Scholes" header |
| 2 | Empty state | "Enter stock price, strike, expiry days, and IV to price the option" |
| 3 | Input fields visible | Stock Price (S), Strike (K), Days to Expiry, Risk-Free Rate %, Implied Volatility %, Option Type |
| 4 | Default risk-free rate | `4.5` (pre-filled) |
| 5 | No result shown | Must fill all inputs first |

---

## TC-102 · Basic call option pricing

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Stock Price (S): `210` | ✓ |
| 2 | Strike (K): `215` | ✓ |
| 3 | Days to Expiry: `30` | ✓ |
| 4 | Risk-Free Rate: `4.5` | ✓ (default) |
| 5 | Implied Volatility: `25` | ✓ |
| 6 | Option Type: **CALL** (green, selected) | ✓ |
| 7 | Result panel appears | Shows **CALL Premium (theoretical)** label |
| 8 | Premium value | e.g. `2.XXXX` (4 decimal places) |
| 9 | ITM/OTM badge | S=210, K=215 → **OTM** (red badge) — stock below strike |

---

## TC-103 · Put option pricing

**Preconditions:** Same inputs as TC-102.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **PUT** button | Switches to put option mode (red color) |
| 2 | Premium | Different value from call (put-call parity) |
| 3 | Both premiums shown | Sub-text: "Both premiums: Call X.XXXX · Put X.XXXX" |
| 4 | S=210, K=215, PUT | **ITM** (green badge) — put is in-the-money when stock < strike |

---

## TC-104 · Greeks display

**Preconditions:** All inputs filled, result shown.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Scroll below premium result | **The Greeks** section with 4 tiles |
| 2 | **Delta (Δ)** | Blue, 4 decimal places. Range: 0–1 for calls, -1–0 for puts |
| 3 | **Gamma (Γ)** | Amber, 6 decimal places |
| 4 | **Theta (Θ)** | Red, negative value (time decay per day) |
| 5 | **Vega (ν)** | Blue, price change per 1% volatility move |
| 6 | Each tile sub-text | Notes what the Greek measures |
| 7 | Debug row below | Shows `d1: X.XXXX  d2: X.XXXX  T: X.XXXXXX yrs  σ: XX.X%` |

---

## TC-105 · Intrinsic vs time value split

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | S=215, K=210 (call ITM) | Premium = intrinsic + time value |
| 2 | Sub-text below premium | "Intrinsic: X.XXXX · Time value: X.XXXX" |
| 3 | Deep ITM call | Time value is small; intrinsic is large |
| 4 | OTM option | Intrinsic = 0.0000; all time value |

---

## TC-106 · Input edge cases (no crash)

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Days = 0 | Empty state shown (T=0 not valid for BS) |
| 2 | IV = 0 | Empty state shown (sigma=0 invalid) |
| 3 | Stock price = 0 | Empty state shown |
| 4 | All filled but clear Stock Price | Empty state (no result, no crash) |

---

---

# SCREEN 15 — Daily Balance Log (New Tab)

---

## TC-107 · Tab exists and shows empty state

**Preconditions:** No entries logged yet. `daily_balance_log` table exists in Supabase.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click **Daily Log** tab | Screen loads with 4 stat cards + calendar grid + right panel |
| 2 | Stat cards (all zero) | All-Time Net: `+RM 0.00` · This Month: `+RM 0.00` · Up Days: `0` · Down Days: `0` |
| 3 | Calendar | Current month shown; all cells empty/dark |
| 4 | Today's cell | Highlighted in **amber** border with `+ log` hint text |
| 5 | Future cells | Faded, not clickable |
| 6 | Right panel empty state | "Click any past day on the calendar to log your daily P&L" |
| 7 | No Recent Entries panel | Not shown when no entries exist |

---

## TC-108 · Log today's entry (positive P&L)

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click today's cell (amber border) | Right panel changes to **Log Entry** form |
| 2 | Date shows | Today's date in YYYY-MM-DD format |
| 3 | Daily P&L input field | Large (text-2xl) number input, autoFocused |
| 4 | Type `250` | Field border turns **green**; text turns **green** |
| 5 | Notes field | Type "Sold VOO position" |
| 6 | Press **Enter** OR click **Save** | Entry saved; form closes; right panel returns to placeholder |
| 7 | Today's calendar cell | Now shows green tint + `+250` below the day number |
| 8 | Stat cards update | All-Time Net: `+RM 250.00` · This Month: `+RM 250.00` · Up Days: `1` |

---

## TC-109 · Log a negative entry

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click any past day | Log Entry form opens |
| 2 | Type `-80` | Field border turns **red**; text turns red |
| 3 | Click **Save** | Entry saved |
| 4 | Calendar cell | Red tint + `-80` shown |
| 5 | Stat cards | Down Days increments; All-Time Net adjusts |

---

## TC-110 · Edit an existing entry

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click a day that already has an entry | Right panel shows **Edit Entry** (not "Log Entry") |
| 2 | Amount field | Pre-filled with existing value |
| 3 | Notes field | Pre-filled with existing notes |
| 4 | Change amount to `300` → click **Update** | Entry updated; calendar cell reflects new value |
| 5 | Stat cards recalculate | Updated totals shown |

---

## TC-111 · Delete an entry

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click a day with an existing entry | Edit Entry panel with **🗑 trash** button (red-bordered) on right side of action row |
| 2 | Click the trash icon | Entry deleted; form closes |
| 3 | Calendar cell | Returns to empty dark state |
| 4 | Stat cards | Totals updated to exclude deleted entry |

---

## TC-112 · Future days are disabled

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Observe calendar cells for tomorrow and beyond | Cells are faded (opacity 0.25) |
| 2 | Click a future cell | Nothing happens — no form opens |
| 3 | Navigate to next month | All cells faded and unclickable |

---

## TC-113 · Calendar navigation

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Click `›` next month | Calendar advances — all cells faded (no logging future) |
| 2 | Click `‹` back | Returns to current month with today highlighted |
| 3 | Navigate to a past month with entries | Entries visible in their correct date cells |
| 4 | Month label | Updates e.g. "April 2026", "March 2026" |

---

## TC-114 · Monthly stat cards update per month view

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Log entries in current month | This Month shows correct total for current month |
| 2 | Navigate to previous month | This Month card reflects that month's total |
| 3 | All-Time Net | Always shows the grand total regardless of which month is viewed |

---

## TC-115 · Recent Entries list

**Preconditions:** At least one entry logged.

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Scroll below the calendar | **Recent Entries** panel visible |
| 2 | Entries listed | Most recent first (reversed chronological) |
| 3 | Max entries shown | 15 most recent |
| 4 | Each row | Date (dim) · Notes text (if any) · Amount in green/red |
| 5 | Positive entry | `+RM 250.00` green |
| 6 | Negative entry | `-RM 80.00` red (shows absolute value with sign) |

---

## TC-116 · Daily Log persists across sessions

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Log 3 entries across different dates | ✓ |
| 2 | Sign out | ✓ |
| 3 | Sign back in → Daily Log tab | All entries still there |
| 4 | Stat cards correct | All-Time Net, Up Days, Down Days match what was logged |

---

---

# CROSS-CUTTING TESTS (UPDATED)

---

## TC-117 · FX conversion flows through all tabs

**Preconditions:** US holding (e.g. VOO × 10) in portfolio. USD/MYR live rate loaded (≠ 4.40 fallback).

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Dashboard → Total Assets | RM value uses live FX (not 4.40) |
| 2 | Dashboard → Market Value | Same FX rate applied |
| 3 | Dividends tab → Est. Annual Income | US dividend income converted at same live rate |
| 4 | Dividends tab → footer | Shows the live FX rate (e.g. "converted at 4.41 USD/MYR") |
| 5 | All tabs agree | No tab shows a different FX rate |

---

## TC-118 · New tabs visible in nav and scroll correctly on mobile

| Step | Action | Expected Behaviour |
|------|--------|--------------------|
| 1 | Log in on a 390px-wide mobile viewport | Nav bar shows scrollable row |
| 2 | Scroll the nav horizontally | All 11 tabs reachable: Dashboard · Watchlist · Analyzer · Portfolio · Dividends · Screener · Sizing · Options · Daily Log · AI Chat · Journal |
| 3 | Click each new tab | Content loads without error |

---

---

# UPDATED QUICK SMOKE TEST (run after every deploy)

Run these steps in order after any code push to confirm nothing is broken:

| # | Step | Expected |
|---|------|----------|
| 1 | Open app URL | Login screen loads |
| 2 | Sign in | Dashboard loads with 4 stat cards (Total Assets, Market Value, P/L, **USD/MYR**) |
| 3 | Dashboard → scroll down | vs Benchmark panel shows VOO and SPY 1M% |
| 4 | ⚙ Settings → paste API key → Save | "✓ Saved!" |
| 5 | Portfolio → Add → search `VOO` → select → qty `10`, cost `500` → Save | Holding in table |
| 6 | Portfolio → Live Prices | Prices update; **Print** button visible in toolbar |
| 7 | Watchlist → + Watch → type `apple` → click AAPL → tag it `US ETF` | AAPL in watchlist with amber `US ETF` tag |
| 8 | Watchlist → click tag filter `US ETF` | Only AAPL shown |
| 9 | Watchlist → Analyze → on AAPL | Analyzer opens, analysis runs, **News panel** appears below chart |
| 10 | Analyzer → zoom out chart with scroll wheel | Candles don't scroll into blank space (fixLeftEdge) |
| 11 | Dividends tab | Data loads; Est. Annual Income updates if VOO pays dividends |
| 12 | Screener → Universe=Portfolio → Scan | VOO row appears with price, change%, yield, P/E |
| 13 | Screener → click Chg % header | Sorts by change; sort arrow shows |
| 14 | Sizing → Entry `2.30`, Stop `2.15`, Target `2.60`, Brokerage `0.10` | Max Shares, Break-even, Total Costs all shown |
| 15 | Options tab → S=210, K=215, Days=30, IV=25 → CALL | Premium, ITM/OTM badge, 4 Greeks shown |
| 16 | Daily Log tab → click today's cell → enter `100` → Save | Calendar shows green cell with `+100`; stat cards update |
| 17 | Journal → Log → fill all → Save | Equity curve appears (if 2+ trades); P&L Calendar updates |
| 18 | AI Chat → type `hello` | Claude replies |
| 19 | Logout | Login screen |

---

---

# UPDATED KNOWN LIMITATIONS

> These are not bugs. Note them so you don't raise false failures.

| # | Limitation | Expected Behaviour |
|---|-----------|-------------------|
| L-01 | Price alerts are NOT real-time | Alerts only check when "Live Prices" is clicked or auto-refresh fires |
| L-02 | AI knowledge cutoff | Fundamentals based on training data. Live price is injected but news events may be stale |
| L-03 | Yahoo Finance 401 | Crumb expires occasionally; app retries once automatically. Wait 5 min on repeated failure |
| L-04 | Twelve Data free tier | 800 req/day limit. US prices fail temporarily when hit. Resets midnight UTC |
| L-05 | MOOMOO CSV import replaces ALL holdings | No merge — all existing holdings deleted then replaced |
| L-06 | Journal P/L | Assumes all qty sold at exit price. No partial fill support |
| L-07 | Performance chart needs 2+ data points | Must click "Live Prices" at least twice |
| L-08 | Settings (capital, risk, model) are per-device | localStorage — not synced across devices |
| L-09 | Auto-refresh background only | No push notifications when app is closed |
| L-10 | Watchlist tags are per-device | Stored in localStorage — signing in from another device shows no tags |
| L-11 | Screener universe is fixed preset | 18 Bursa + 8 US symbols. Cannot add custom symbols to preset; use "All" universe instead |
| L-12 | Dividend data is trailing 12-month | Not a forward estimate. New dividends not reflected until Yahoo Finance updates |
| L-13 | Options Calculator is theoretical | Uses Black-Scholes assumptions (European-style, no dividends). Real market prices may differ |
| L-14 | Daily Balance Log is manual | Does not auto-populate from trades — user must enter manually each day |
| L-15 | Screener max ~50 symbols per scan | Chunked in 30s per API call. Very large custom universes may be slow |
| L-16 | Chart fixLeftEdge | Zoom-out stops at first loaded candle. To see older history, change range button (1Y/5Y) |

---

*AI Trade Desk · Built for Wen Xiang · Not financial advice*
