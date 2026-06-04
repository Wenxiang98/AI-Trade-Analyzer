# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Trade Desk is a personal AI-powered trading workstation for Malaysian retail traders, targeting US ETFs (VOO, SPY, QQQ) and Bursa Malaysia stocks. It combines portfolio tracking, stock analysis, position sizing, and an AI trading advisor.

- **Frontend:** React 18 SPA deployed on Vercel
- **Backend:** Spring Boot 3.3 (Java 21) deployed on Railway (Docker)
- **Database/Auth:** Supabase (PostgreSQL + Row-Level Security)
- **AI Engine:** Anthropic Claude (model selectable: Haiku 4.5, Sonnet 4.6, Opus 4.7)

## Commands

### Frontend
```bash
npm install        # Install dependencies
npm run dev        # Dev server at localhost:5173
npm run build      # Production build → /dist
npm run preview    # Preview production build locally
```

### Backend (from `backend/`)
```bash
mvn clean package -DskipTests    # Build fat JAR
mvn spring-boot:run              # Run locally on port 8080
```

### Docker (Backend)
```bash
docker build -t ai-trade-backend ./backend
docker run -p 8080:8080 -e PORT=8080 ai-trade-backend
```

There are no automated test suites — manual testing follows `TEST_GUIDE_V2.md`.

## Architecture

### Data Flow
```
Browser
  ├── Supabase Auth (JWT)
  ├── Supabase DB (portfolio, journal, watchlist, alerts)
  ├── Anthropic API directly (client-side, key in localStorage)
  └── Spring Boot backend (market data proxy only)
          ├── Twelve Data API  ← US stocks/ETFs (800 req/day free tier)
          └── Yahoo Finance v7/v8 ← Bursa Malaysia (cookie+crumb session)
```

### Frontend (`src/`)

`src/App.jsx` is a monolith (~2500+ lines) containing all tab-based views: Dashboard, Analyzer, Portfolio Manager, Position Sizing Calculator, AI Trader Chat, Trading Journal, and Settings. Phase 2 will split these into `src/components/`. State is managed entirely with React hooks; Supabase is the persistence layer.

`src/lib/supabase.js` — Supabase client initialization and all CRUD helpers (holdings, journal, watchlist, alerts, snapshots).

`src/components/LoginScreen.jsx` — Supabase email/password auth UI. All data is user-isolated via RLS.

### Backend (`backend/src/main/java/com/aitrade/`)

- **`MarketDataController`** — REST endpoints for quotes, search, chart, news, screener, dividends
- **`MarketDataService`** — Routes symbols to the correct data source: symbols ending in `.KL` go to Yahoo Finance; all others go to Twelve Data
- **`YahooFinanceService`** — Manages Yahoo Finance cookie+crumb sessions (~25 min TTL); handles session refresh automatically
- **`ClaudeProxyController`** — Proxies Anthropic API calls (requires valid Supabase JWT via `JwtFilter`)
- **`SecurityConfig`** — CORS config + JWT validation setup

### Backend API Endpoints
```
GET  /api/market/quote/{symbol}          # Single live quote
GET  /api/market/quotes?symbols=...      # Batch quotes
GET  /api/market/search?q=...            # Symbol search
GET  /api/market/chart/{symbol}?range=6M # OHLCV chart data
GET  /api/market/screener?symbols=...    # Batch fundamentals
GET  /api/market/dividend/{symbol}       # Dividend info
GET  /api/market/news/{symbol}           # News headlines
POST /api/claude                         # Claude API proxy (JWT required)
```

### Database Schema (`supabase/schema.sql`)

Key tables (all with RLS — users see only their own rows):
- **`profiles`** — extends `auth.users`; stores `cash_balance` and `anthropic_api_key`
- **`portfolio_holdings`** — positions: symbol, qty, avg_cost, current_price, market
- **`journal_trades`** — trade log with entry/exit/P&L/notes
- **`watchlist`** — watched symbols with tags
- **`price_alerts`** — price alert targets with triggered flag
- **`portfolio_snapshots`** — daily P&L snapshots for performance charts
- **`daily_log`** — manual daily P&L calendar entries

### Configuration

| Environment | Config file |
|---|---|
| Local dev | `backend/src/main/resources/application.properties` |
| Railway (prod) | `backend/src/main/resources/application-railway.properties` |

Required env vars for backend: `SUPABASE_JWT_SECRET`, `TWELVEDATA_API_KEY`, `PORT`.

The Anthropic API key is stored client-side in Supabase `profiles.anthropic_api_key` (personal tool design — not a multi-tenant SaaS).

### Deployment

- **Frontend:** Push to `main` → Vercel auto-deploys. `vercel.json` rewrites all routes to `index.html` for SPA routing.
- **Backend:** Railway builds via `backend/Dockerfile` (multi-stage Alpine: Maven → JRE 21). Active Spring profile is `railway`.
