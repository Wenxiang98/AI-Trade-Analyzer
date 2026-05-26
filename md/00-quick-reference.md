# Quick Reference Card

Fast-access cheat sheet for daily development and trading use.

---

## Dev Commands

```bash
npm run dev          # Start local dev (localhost:5173)
npm run build        # Build for production
git add . && git commit -m "msg" && git push   # Deploy to Vercel
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Everything — all React components |
| `src/index.css` | Tailwind imports + custom CSS |
| `vercel.json` | SPA routing config |
| `docs/` | All planning and architecture docs |

---

## localStorage Keys

| Key | Contents |
|---|---|
| `portfolio:holdings` | Array of positions |
| `portfolio:cash` | RM cash balance |
| `journal:trades` | Array of logged trades |
| `settings:capital` | Trading capital (RM) |
| `settings:riskPct` | Risk % per trade |
| `anthropic_api_key` | Claude API key |

---

## COLORS Reference

```javascript
bg:         '#0a0a0a'   // Page background
panel:      '#141414'   // Card background
panelLight: '#1a1a1a'   // Input background
border:     '#262626'   // All borders
text:       '#e5e5e5'   // Primary text
textDim:    '#737373'   // Secondary text
green:      '#10b981'   // Profit / BUY
red:        '#ef4444'   // Loss / SELL
amber:      '#f59e0b'   // Warning / HOLD
blue:       '#3b82f6'   // Info
```

---

## Trading Rules Quick-Check

Before any trade, confirm:
- [ ] Stop loss defined?
- [ ] Position size ≤ 2% risk? (RM 20 on RM 1,000)
- [ ] R:R ≥ 1:2?
- [ ] Entry is not chasing (stock already ran 10%+)?
- [ ] No major earnings/catalyst risk in 48 hours?
- [ ] Logged in Journal?

---

## DCA Schedule

| Date | Action | Amount |
|---|---|---|
| 1st of every month | Buy VOO on Moomoo | RM 300–500 |

---

## Useful Links

| Resource | URL |
|---|---|
| Live App | `https://ai-trade-desk-[hash].vercel.app` |
| GitHub Repo | `https://github.com/Wenxiang98/ai-trade-desk` |
| Vercel Dashboard | `https://vercel.com/dashboard` |
| Anthropic Console | `https://console.anthropic.com` |
| Moomoo Web | `https://www.moomoo.com` |
| Bursa Malaysia | `https://www.bursamalaysia.com` |

---

## Claude API Model

```
claude-sonnet-4-20250514
```

---

## Phase Status

| Phase | Status |
|---|---|
| MVP 1 — Core trading desk | ✅ Complete |
| Phase 2 — Intelligence + real data | 🔜 Next |
| Phase 3 — Backend + sync | 🔮 Future |
| Phase 4 — Advanced charting | 🔮 Future |
