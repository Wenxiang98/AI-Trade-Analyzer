# 🤖 AI Trade Desk

A personal AI-powered trading desk for analyzing stocks, ETFs, and managing your portfolio. Built with React + Vite + Claude AI.

> **For Wen Xiang** — Personal trading workstation supporting US ETFs (VOO/SPY/QQQ) and Bursa Malaysia stocks.

---

## ✨ Features

- 📊 **Dashboard** — Portfolio overview, allocation chart, AI daily insights
- 🔍 **Smart Analyzer** — Search any ticker, get AI-powered Buy/Sell/Hold verdict + trade plan
- 💼 **Portfolio Manager** — Track holdings with live P/L
- ⚖️ **Position Sizing Calculator** — Built-in 2% risk rule
- 🤖 **AI Trader Chat** — Free-form chat with Claude that knows your portfolio
- 📓 **Trading Journal** — Log trades, AI surfaces behavioral patterns

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+ ([download](https://nodejs.org))
- npm (comes with Node)
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` — the app will load. Click the ⚙️ gear icon in the top-right to enter your Anthropic API key (stored only in your browser).

### Build for Production

```bash
npm run build
npm run preview  # preview the production build locally
```

The built site is in `dist/`.

---

## 🌐 Deploy to Vercel (Recommended — Free)

### One-time setup:

1. Push this repo to GitHub (see below)
2. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
3. Click **"Add New Project"** → Import your `ai-trade-desk` repo
4. Vercel auto-detects Vite. Click **Deploy**.
5. You'll get a live URL like `ai-trade-desk-xyz.vercel.app`

### Auto-deploys:

Every time you `git push`, Vercel auto-rebuilds and deploys. No manual steps.

---

## 📦 Push to GitHub

First time:

```bash
git init
git add .
git commit -m "Initial commit: AI Trade Desk v1.0"
git branch -M main
git remote add origin https://github.com/Wenxiang98/ai-trade-desk.git
git push -u origin main
```

After making changes:

```bash
git add .
git commit -m "Your update message"
git push
```

Vercel will auto-redeploy within ~1 minute.

---

## 🔑 API Key Management

The Anthropic API key is stored in your browser's `localStorage` — never sent to any server other than Anthropic's API directly.

**Important:** Since this is a client-side app, the API key lives in the browser. Don't commit it to git. Each user (including you on a new device) will need to enter it once via the ⚙️ Settings modal.

For production use with multiple users, you'd want a backend proxy — but for a personal tool, this is fine.

---

## 📂 Project Structure

```
ai-trade-desk/
├── src/
│   ├── App.jsx         # Main app (all components)
│   ├── main.jsx        # React entry
│   └── index.css       # Tailwind + custom CSS
├── public/             # Static assets
├── index.html          # HTML entry
├── package.json        # Dependencies
├── vite.config.js      # Vite config
├── tailwind.config.js  # Tailwind config
├── vercel.json         # Vercel routing
└── README.md
```

---

## ⚠️ Disclaimers

- AI analysis is based on general knowledge — not real-time market data
- Always verify with live charts before trading
- **Not financial advice**
- Past performance doesn't guarantee future results

---

## 📜 License

Personal use. Built with Claude Sonnet 4.
