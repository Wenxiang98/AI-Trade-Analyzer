# Claude Code Workflow

How to use Claude Code to continue building AI Trade Desk efficiently.

---

## Setup Claude Code for This Project

```bash
# Install Claude Code globally (if not done)
npm install -g @anthropic-ai/claude-code

# Navigate to your project
cd ai-trade-desk

# Launch Claude Code
claude
```

---

## Recommended First Prompt in Claude Code

Paste this when starting a new Claude Code session on this project:

```
I'm working on AI Trade Desk — a personal React + Vite trading app.

Context:
- Stack: React 18, Vite, Tailwind CSS, Lucide React, Recharts
- AI: Anthropic Claude Sonnet 4 called directly from browser
- Storage: localStorage (no backend in MVP 1)
- Main file: src/App.jsx (monolith, all components inside)
- Docs: See /docs folder for project intro, phases, and architecture

Current MVP 1 is complete. I want to work on [describe what you want].

Please read the relevant docs files first before making changes.
```

---

## Docs Folder Convention

Add the docs folder to your repo so Claude Code always has context:

```
ai-trade-desk/
├── docs/
│   ├── 01-project-intro.md
│   ├── 02-mvp1-features.md
│   ├── 03-phases-roadmap.md
│   ├── 04-setup-deployment.md
│   ├── 05-trading-strategy.md
│   ├── 06-claude-skill.md
│   ├── 07-technical-architecture.md
│   └── 08-claude-code-workflow.md   ← this file
├── src/
│   └── App.jsx
...
```

---

## Commit Convention

Use clear commit messages so git history is readable:

```bash
# Feature addition
git commit -m "feat: add watchlist tab with price tracking"

# Bug fix
git commit -m "fix: analyzer JSON parse failing on SUNREIT ticker"

# Refactor
git commit -m "refactor: split App.jsx into component files"

# Style / UI
git commit -m "style: improve mobile layout for Portfolio tab"

# Docs
git commit -m "docs: update phase 2 checklist with watchlist tasks"
```

---

## Branch Strategy (Optional but Recommended)

For bigger changes, work on a branch:

```bash
# Create feature branch
git checkout -b feat/watchlist

# Work and commit on branch
git add .
git commit -m "feat: add watchlist MVP"

# Merge back to main when done
git checkout main
git merge feat/watchlist
git push
```

Vercel only deploys `main` by default — feature branches won't affect your live site.

---

## Common Claude Code Tasks

### Adding a New Tab/Feature
```
Add a new "Watchlist" tab to the app.
- Tab icon: Eye (from lucide-react)
- Insert between Analyzer and Portfolio in the nav
- Watchlist stores tickers in localStorage key 'watchlist:tickers'
- Each row shows: Symbol, Last Price (manual), Notes, Remove button
- Add Watchlist button opens an inline form
```

### Fixing a Bug
```
Bug: When I type a ticker in Analyzer and hit Enter quickly, 
the search fires twice. Fix the duplicate API call issue.
```

### Refactoring
```
Refactor App.jsx — extract the Chat component into 
src/components/Chat/index.jsx keeping all existing logic intact.
Also extract the shared Panel, StatCard, Row, PlanItem, Field, Result 
components into src/components/ui/index.jsx
```

### Adding Real-Time Prices
```
Integrate Yahoo Finance prices via the unofficial API endpoint:
https://query1.finance.yahoo.com/v8/finance/chart/{ticker}

Add a "Refresh Prices" button to the Portfolio tab that fetches 
current prices for all holdings and updates currentPrice in state.
Handle errors gracefully (some Bursa tickers may not be available).
```

---

## Phase 2 Starting Prompt (Ready to Copy)

When you're ready to start Phase 2, use this:

```
I've completed MVP 1 of AI Trade Desk. Now starting Phase 2.

Current state:
- React + Vite + Tailwind, all components in src/App.jsx
- localStorage for data persistence
- Claude Sonnet 4 for AI features
- Deployed on Vercel, repo at github.com/Wenxiang98/ai-trade-desk

Phase 2 goals (in priority order):
1. Refactor App.jsx into component files
2. Add Watchlist tab
3. Add DCA Tracker tab
4. Add PWA manifest for better iPhone install
5. Integrate Yahoo Finance for auto price refresh

Let's start with the refactor. Read src/App.jsx first, 
then propose the new file structure before making any changes.
```

---

## Useful Context to Give Claude Code

Always mention:
- The file you want changed (e.g. `src/App.jsx`)
- Where a new component should go
- Whether data should persist (localStorage key)
- Whether it needs an AI call (and which tab it's in)
- Mobile considerations (the app is used on iPhone)

---

## Testing Checklist Before Every Commit

```
[ ] npm run build passes without errors
[ ] App loads at localhost:5173
[ ] Analyzer search works (try "VOO" and "apple")
[ ] Portfolio data persists on page refresh
[ ] Chat sends and receives response
[ ] Works on mobile viewport (Chrome DevTools → 390px width)
[ ] No console errors in browser
```
