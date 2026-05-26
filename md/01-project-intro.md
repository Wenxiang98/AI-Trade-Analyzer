# AI Trade Desk — Project Introduction

## Overview

A personal AI-powered trading workstation built specifically for Wen Xiang. Combines portfolio tracking, stock analysis, position sizing, and an AI trading advisor — all in one responsive web app accessible on any device.

---

## Owner

- **Name:** Wen Xiang
- **GitHub:** `Wenxiang98`
- **Location:** Malaysia (Petaling Jaya, Selangor)
- **Broker:** Moomoo (Universal Account 8093)

---

## Why This Project Exists

Wen Xiang is an early-stage retail trader who wanted:
- Structured, data-driven support instead of gut-feel trading
- An AI that acts as a personal analyst — not just generic information
- A tool that knows his actual portfolio, capital, and risk tolerance
- Access from both desktop and mobile (his primary device)

### Current Portfolio (as at project start — May 2026)
| Field | Value |
|---|---|
| Total Assets | RM 690.54 |
| Market Value | RM 687.00 |
| Position P/L | +RM 46.19 |
| Cash | RM 3.54 |
| Risk Status | Safe |
| Holding | SUNREIT (5176) — 300 units @ RM 2.16 |

---

## Markets of Interest
- **US ETFs:** VOO, SPY, QQQ (primary DCA targets)
- **Bursa Malaysia:** REITs, banks, semiconductor stocks
- **Strategy:** DCA into VOO/SPY long-term + disciplined swing trading on Bursa

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| AI Engine | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| Charts | Recharts |
| Icons | Lucide React |
| Storage | `localStorage` (browser-based, per device) |
| Hosting | Vercel (free tier, auto-deploy on git push) |
| Repo | GitHub — `Wenxiang98/ai-trade-desk` |

---

## Design Direction

- **Theme:** Dark (Bloomberg Terminal × modern minimalism)
- **Colors:** Charcoal/black background, green (gains), red (losses), amber (warnings)
- **Typography:** JetBrains Mono (numbers/tickers) + Fraunces (headers)
- **Mobile-first:** Designed for iPhone access via "Add to Home Screen"

---

## Key Constraints

1. **No Moomoo API** — Moomoo has no public API. Portfolio is entered manually.
2. **No backend (MVP)** — All data lives in browser `localStorage`. No server.
3. **API key client-side** — Anthropic key stored in localStorage, entered via Settings modal.
4. **Not financial advice** — All AI outputs are analytical support, not guaranteed recommendations.

---

## Repository Structure

```
ai-trade-desk/
├── src/
│   ├── App.jsx           # All components (monolith for MVP)
│   ├── main.jsx          # React entry
│   └── index.css         # Tailwind + custom CSS
├── public/               # Static assets
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json           # SPA routing config
├── .gitignore
└── README.md
```
