# Handover: Initial PolyTrader Build

**Datum**: 2026-04-03
**Sessie**: Volledige opbouw van het PolyTrader platform

## Wat is gebouwd

Het complete PolyTrader platform — een prediction market trading tool die weather ensemble forecasts gebruikt om edges te vinden op Polymarket weather markets. Draait in paper trading modus (NL is geblokkeerd door KSA).

### Frontend (Next.js 15 + React 19)
- Dark-mode-only trading dashboard met 6 pagina's: Dashboard, Algorithms, Signals, Portfolio, Markets, Settings
- shadcn/ui componenten (Card, Table, Badge, Dialog, Tabs, Separator)
- Recharts voor grafieken
- Supabase JS client voor real-time data
- PAPER TRADING badge altijd zichtbaar bovenaan
- Monospace font (JetBrains Mono) voor alle numerieke waarden

### Backend (Python 3.12 + FastAPI)
- Vercel serverless via Mangum adapter
- Open-Meteo ensemble client (ECMWF 51 members, GFS 31, ICON 40)
- Polymarket Gamma API client (market discovery) + CLOB API client (pricing)
- Weather temperature strategy: parseert markt-vragen met regex, berekent ensemble probability, vergelijkt met marktprijs
- Trading engine: Kelly criterion position sizing, risk management (9 checks), paper trading
- Webhook endpoints voor n8n automatisering (scan-signals, sync-prices, check-resolutions, daily-snapshot, sync-weather)

### Database (Supabase)
- Project: PolyTrader (`wfjwyragybeadbbcwwuz`) in eu-west-1
- 10 tabellen: markets, price_history, strategies, signals, trades, positions, forecasts, pnl_snapshots, audit_log, weather_forecasts
- RLS enabled op alle tabellen
- Triggers: auto Brier score berekening, auto PnL berekening, auto updated_at
- Realtime enabled op: signals, trades, positions, pnl_snapshots
- Seed data: weather_temperature strategy

### Automatisering (n8n)
5 workflows aangemaakt op hetmarketinglab.app.n8n.cloud:

| Workflow | ID | Schedule | Endpoint |
|----------|-----|----------|----------|
| Poly - Weather Signal Scanner | hCV7d0KT70ZueMtF | Elke 5 min | /api/webhook/scan-signals |
| Poly - Price Sync | PqOhtUUrGWX1EW6N | Elke 15 min | /api/webhook/sync-prices |
| Poly - Resolution Checker | XFNvWsZ2aPPK0tCV | Elk uur | /api/webhook/check-resolutions |
| Poly - Daily Report | tcWOFr2Bn5zIW4t4 | Dagelijks 09:00 UTC | /api/webhook/daily-snapshot |
| Poly - Weather Sync | VZVEkgXieMPvVEc0 | Elke 6 uur (00:30, 06:30, 12:30, 18:30) | /api/webhook/sync-weather |

URL en webhook secret staan direct in de flows (geen n8n env vars nodig).

### CI/CD
- GitHub repo: github.com/abescholten/polytraderabe
- Vercel auto-deploy op push naar main
- GitHub Actions CI: frontend lint+build, backend ruff check

## Belangrijke beslissingen

1. **n8n ipv Vercel Crons**: Vercel Hobby plan ondersteunt maar 1 cron/dag. n8n handelt alle scheduling.
2. **Paper trading only**: NL is geblokkeerd door KSA. ENABLE_LIVE_TRADING=false is hardcoded.
3. **Publishable key ipv anon key**: Supabase moderne publishable key (`sb_publishable_...`) gebruikt ipv legacy JWT anon key.
4. **Weather data elke 6 uur**: Open-Meteo ensemble models updaten 4x/dag. Vaker ophalen geeft identieke data.
5. **12 Europese steden**: Amsterdam, Berlijn, Brussel, Londen, Parijs, Wenen, Zurich, Rome, Madrid, Lissabon, Praag, Warschau.

## Bestanden aangemaakt/gewijzigd

### Root
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `vercel.json`
- `CLAUDE.md`, `.gitignore`
- `.github/workflows/ci.yml`

### Frontend (apps/web/)
- 6 route pagina's (/, /algorithms, /signals, /portfolio, /markets, /settings)
- Layout componenten (sidebar, header, mode-badge)
- Dashboard componenten (portfolio-summary, active-signals, recent-trades, strategy-health)
- Common componenten (probability-badge, edge-indicator, market-link)
- Supabase clients, types, utilities, API client

### Backend (services/api/)
- 6 API routers (signals, strategies, portfolio, markets, health, webhooks)
- Weather data clients (open_meteo.py, probability.py)
- Market data clients (gamma.py, clob.py)
- Trading engine (strategies/weather_temp.py, risk/manager.py, execution/engine.py, execution/paper.py)
- Pydantic models (signal.py, market.py, trade.py, strategy.py)
- Vercel entrypoint (api/main.py)

### Database (supabase/migrations/)
- 001_core_schema.sql — 9 tabellen
- 002_rls_policies.sql — RLS + policies
- 003_functions.sql — Triggers + functions
- 004_realtime.sql — Realtime publicatie
- 005_seed_strategy.sql — Weather strategy seed
- 006_weather_forecasts.sql — Weather data tabel

## Environment Variables

### Vercel (ingesteld)
| Variable | Status |
|----------|--------|
| NEXT_PUBLIC_SUPABASE_URL | Ingesteld |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Ingesteld (publishable key) |
| SUPABASE_SERVICE_ROLE_KEY | Ingesteld door gebruiker |
| WEBHOOK_SECRET | Ingesteld |
| ENABLE_LIVE_TRADING | false |

## Verificatie

- Dashboard live op: https://polytraderabe.vercel.app
- Vercel deployment status: READY
- Supabase project: ACTIVE_HEALTHY
- n8n workflows: aangemaakt, moeten nog geactiveerd worden

## Bekende issues / follow-up

1. **n8n workflows moeten nog geactiveerd worden** door gebruiker
2. **scan-signals column mismatch**: de webhook schrijft `strategy` maar de tabel verwacht `strategy_name` — al gefixt in latere commit
3. **Weather strategy leest nog live van Open-Meteo** ipv uit Supabase cache — optimalisatie voor later
4. **Geen auth op dashboard** — iedereen met de URL kan erbij. Overweeg Supabase Auth of Vercel Sign-In
5. **Backtest is vereenvoudigd** — gebruikt gesimuleerde data ipv echte historische forecasts
