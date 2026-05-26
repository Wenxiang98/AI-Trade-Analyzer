# Setup & Deployment Steps

Complete guide from downloaded zip to live on Vercel — and workflow for future updates.

---

## Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ (LTS) | [nodejs.org](https://nodejs.org) |
| Git | Any | [git-scm.com](https://git-scm.com) |
| VS Code (optional) | Any | [code.visualstudio.com](https://code.visualstudio.com) |
| Anthropic API key | — | [console.anthropic.com](https://console.anthropic.com) |

---

## Step 1 — Local Setup

```bash
# 1. Unzip the project and navigate to it
cd ai-trade-desk

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

Click the ⚙️ **gear icon** (top-right) → paste your Anthropic API key → Save.

Test by going to **Analyzer** → search `VOO` → verify analysis loads.

---

## Step 2 — Create GitHub Repository

1. Go to [github.com/Wenxiang98](https://github.com/Wenxiang98)
2. Click **"New repository"**
3. Fill in:
   - Name: `ai-trade-desk`
   - Description: `Personal AI-powered trading desk`
   - Visibility: **Private**
   - ❌ Do NOT add README / .gitignore / license (already included)
4. Click **"Create repository"**

---

## Step 3 — Push Code to GitHub

Run these in your terminal inside the project folder:

```bash
git init
git add .
git commit -m "Initial commit: AI Trade Desk v1.0"
git branch -M main
git remote add origin https://github.com/Wenxiang98/ai-trade-desk.git
git push -u origin main
```

> **If prompted for password:** GitHub no longer accepts passwords. Use a Personal Access Token:
> - GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
> - New token → check `repo` scope → copy
> - Paste as password when prompted

Verify: visit `github.com/Wenxiang98/ai-trade-desk` — all files should be visible.

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Dashboard → **"Add New..."** → **"Project"**
3. Find `ai-trade-desk` → click **"Import"**
4. Vercel auto-detects Vite. No configuration needed.
5. Click **"Deploy"**
6. Wait ~60 seconds → **"🎉 Congratulations!"**

Your live URL: `https://ai-trade-desk-[hash].vercel.app`

> Optionally: go to Project Settings → Domains → add a custom domain (e.g. `trade.yourdomain.com`)

---

## Step 5 — Add to iPhone Home Screen

1. Open the Vercel URL in **Safari** (must be Safari)
2. Tap **Share icon** (box with arrow)
3. Scroll → **"Add to Home Screen"**
4. Name: `Trade Desk` → **Add**
5. Open from home screen — launches fullscreen like a native app

---

## Step 6 — API Key on Each Device

The API key is stored per-browser. On each new device:

1. Open the app URL
2. Tap ⚙️ Settings
3. Paste Anthropic API key
4. Save — persists on that device

---

## Future Update Workflow

Every time you want changes deployed:

```bash
# 1. Make your changes locally (or receive updated files)
# 2. Test with:
npm run dev

# 3. Commit and push:
git add .
git commit -m "Brief description of change"
git push
```

Vercel detects the push and **auto-redeploys in ~60 seconds**.
No manual deployment steps ever needed again.

---

## Useful Commands

```bash
npm run dev        # Start local dev server (http://localhost:5173)
npm run build      # Build for production (outputs to /dist)
npm run preview    # Preview production build locally

git status         # See what files changed
git log --oneline  # See commit history
git diff           # See exact code changes
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails | Check Node version: `node --version` (needs 18+) |
| Git push rejected | Use Personal Access Token (not account password) |
| Vercel build fails | Check build logs in Vercel dashboard; run `npm run build` locally first |
| App loads but AI calls fail | Check API key in ⚙️ Settings; check credit at console.anthropic.com |
| Data disappeared | localStorage was cleared; re-enter portfolio manually |
| Analyzer returns error | Check browser console (F12) for specific API error message |
