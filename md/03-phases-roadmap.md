# Development Phases — Roadmap

## Overview

| Phase | Focus | Status |
|---|---|---|
| MVP 1 | Core trading desk — analyzer, portfolio, chat, journal | ✅ Complete |
| Phase 2 | Intelligence layer + real data | 🔜 Next |
| Phase 3 | Backend + sync | 🔮 Future |
| Phase 4 | Polish + scale | 🔮 Future |

---

## ✅ Phase 1 — MVP (Complete)

**Goal:** A working personal trading desk, deployable, mobile-accessible.

### Delivered
- [x] Dashboard with portfolio summary + AI insight
- [x] Smart stock search (exact match + suggestions)
- [x] Full AI stock analysis (verdict, technical, fundamental, risks, trade plan)
- [x] Portfolio manager with localStorage persistence
- [x] Position sizing calculator (2% rule built-in)
- [x] AI Trader Chat (Claude with portfolio context)
- [x] Trading Journal with AI pattern analysis
- [x] Settings modal (API key management)
- [x] Floating "Ask AI" button
- [x] Mobile-responsive dark theme
- [x] Vite + React project structure
- [x] Vercel deployment config
- [x] GitHub repo ready (`Wenxiang98/ai-trade-desk`)
- [x] Deployment guide documentation

---

## 🔜 Phase 2 — Intelligence Layer

**Goal:** Real data, smarter analysis, better UX.

### Features to Build
- [ ] **Real-time price integration** — Connect to a free stock API (e.g. Yahoo Finance via `yfinance` proxy, or Alpha Vantage free tier) to auto-update portfolio prices
- [ ] **Watchlist tab** — Add tickers to a watchlist, track them without holding a position
- [ ] **DCA Tracker** — Calendar view of planned DCA buys, progress toward monthly target, total invested vs current value
- [ ] **PWA manifest** — Proper `manifest.json` + service worker so the app installs cleanly as a home screen app with icon and splash screen
- [ ] **Portfolio performance chart** — Line chart of total portfolio value over time (logged at each session)
- [ ] **Multi-market support** — Explicit Bursa vs US toggle in analyzer, price display in correct currency
- [ ] **Component refactor** — Split `App.jsx` into `src/components/` (Dashboard, Analyzer, Portfolio, Sizing, Chat, Journal, shared UI)
- [ ] **Export journal to CSV** — Download trade history as spreadsheet

### Technical
- [ ] Move to component-based file structure
- [ ] Add `react-router-dom` for URL-based navigation
- [ ] Add proper loading skeletons instead of spinners

---

## 🔮 Phase 3 — Backend + Sync

**Goal:** Data that follows you across devices.

### Features to Build
- [ ] **Backend API** — Lightweight server (options: Supabase, Firebase, or simple Express on Railway/Render)
- [ ] **User authentication** — Login so data is tied to account, not browser
- [ ] **Cloud sync** — Portfolio, journal, and settings sync across iPhone + laptop
- [ ] **Secure API key proxy** — Move Anthropic API calls through backend so key is never client-side
- [ ] **Price alert system** — Set a price alert for any ticker, get notified (email or push)

### Technical
- [ ] Decide: Supabase (PostgreSQL + auth + realtime) vs Firebase (NoSQL + simpler)
- [ ] Implement JWT or session-based auth
- [ ] Build `/api/analyze` endpoint that proxies to Anthropic (keeps key server-side)

---

## 🔮 Phase 4 — Polish + Scale

**Goal:** Production-quality personal finance tool.

### Features to Build
- [ ] **Advanced charting** — Candlestick charts with indicators (MA, RSI, MACD) via lightweight-charts or TradingView widget
- [ ] **Sector rotation dashboard** — Visual overview of which sectors are hot/cold
- [ ] **DCA compound calculator** — Interactive projector for long-term DCA into VOO with adjustable monthly amount and years
- [ ] **Multi-portfolio support** — Separate tracked portfolios (e.g. "Long Term" vs "Active Trading")
- [ ] **Moomoo CSV import** — Parse and import Moomoo trade history export file
- [ ] **Notification system** — Browser push notifications for price alerts
- [ ] **Dark/light mode toggle**

---

## Priority Queue (What to Build Next)

When starting Phase 2, tackle in this order:

1. **Component refactor first** — makes everything else easier
2. **Watchlist tab** — quick win, high daily use value
3. **DCA Tracker** — directly supports Wen Xiang's chosen strategy
4. **PWA manifest** — makes iPhone experience much better
5. **Real-time prices** — removes the biggest manual friction
