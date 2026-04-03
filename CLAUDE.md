# Polymarket Trader

A prediction market trading platform with weather-based algorithms, React dashboard, Python backend, and Supabase database — deployed on Vercel with GitHub CI/CD.

## ⚠️ Jurisdictional Notice

The Netherlands is **blocked from Polymarket trading** (KSA enforcement, €420K/week fines, API-level geoblocking). This project operates in **paper trading / analytics mode** by default. Live trading requires deployment from an unrestricted jurisdiction. The `ENABLE_LIVE_TRADING` flag must be explicitly set — never default to live.

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 + React 19 | App Router, TypeScript strict |
| Backend | Python 3.12 + FastAPI | Vercel serverless functions (Mangum) |
| Database | Supabase (PostgreSQL) | RLS enabled, real-time for dashboard |
| Automation | n8n | 5 scheduled workflows (Poly - prefix) |
| Weather Data | Open-Meteo Ensemble API | Free, no API key, ECMWF/GFS/ICON |
| Market Data | Polymarket CLOB + Gamma API | py-clob-client SDK |
| Deployment | Vercel + GitHub Actions | Auto-deploy on main, preview on PR |
| Package Manager | pnpm | Workspace monorepo |

## Weather Data Collection

Ensemble forecasts for 12 European capitals (Amsterdam, Berlin, Brussels, London, Paris, Vienna, Zurich, Rome, Madrid, Lisbon, Prague, Warsaw) are fetched every 6 hours from Open-Meteo and stored in the `weather_forecasts` table. Three models per city: ECMWF (51 members), GFS (31), ICON (40).

## Handover Documents

After every work session, a handover document MUST be created in `docs/handovers/` with the filename format `YYYY-MM-DD-<summary>.md`. The document must include:
- What was built or changed
- Why (context/motivation)
- Key decisions made and their rationale
- Files created or modified
- Environment variables added
- External services configured (Supabase migrations, n8n workflows, Vercel settings)
- Known issues or follow-up items
- How to verify the changes work

## Project Structure

```
polymarket-trader/
├── CLAUDE.md                          # This file
├── .claude/skills/                    # Claude Code skills
│   ├── polymarket-api.md              # Polymarket API integration
│   ├── weather-signals.md             # Weather forecasting + probability
│   ├── trading-engine.md              # Trading logic, Kelly, risk mgmt
│   ├── trader-frontend.md             # Next.js dashboard
│   ├── trader-backend.md              # Python FastAPI backend
│   ├── trader-data.md                 # Supabase schema + data pipeline
│   ├── trader-deployment.md           # Vercel/GitHub/Railway deploy
│   ├── backtesting.md                 # Backtesting + calibration
│   ├── local-testing.md               # Run full local test suite
│   ├── pre-deploy-check.md            # Pre-deployment verification gate
│   ├── pre-commit-verify.md           # Pre-commit quality checks
│   ├── write-backend-tests.md         # Write pytest tests for Python
│   └── write-frontend-tests.md        # Write Vitest tests for React/TS
├── apps/
│   └── web/                           # Next.js dashboard app
│       ├── src/app/                   # App Router pages
│       ├── src/components/            # React components
│       ├── src/lib/                   # Utilities, API clients
│       └── package.json
├── services/
│   └── api/                           # Python backend
│       ├── src/
│       │   ├── api/                   # FastAPI route handlers
│       │   ├── trading/
│       │   │   ├── strategies/        # Algorithm modules
│       │   │   ├── execution/         # Order execution + paper mode
│       │   │   ├── risk/              # Risk management
│       │   │   └── backtesting/       # Backtesting engine
│       │   ├── data/
│       │   │   ├── weather/           # Open-Meteo integration
│       │   │   ├── market/            # Polymarket API integration
│       │   │   │   ├── clob.py        # CLOB prices + orderbook
│       │   │   │   ├── gamma.py       # Market discovery (tag/keyword)
│       │   │   │   └── discovery.py   # EU/US city search + classifier
│       │   │   └── pipeline/          # Data sync + caching
│       │   └── models/                # Pydantic models + types
│       ├── tests/
│       ├── pyproject.toml
│       └── requirements.txt
├── supabase/
│   ├── migrations/                    # SQL migrations
│   └── config.toml
├── vercel.json
├── turbo.json
├── pnpm-workspace.yaml
└── .github/workflows/
    └── deploy.yml
```

## Code Style

### TypeScript (Frontend)
- Strict mode, no `any`
- React functional components only, named exports
- Hooks for state, no class components
- Tailwind CSS for styling (no CSS modules)
- Recharts for charts, shadcn/ui for components

### Python (Backend)
- Type hints everywhere, enforced by mypy
- Ruff for linting, Black for formatting
- Pydantic v2 for all data models
- Async FastAPI endpoints
- Pytest for testing

## Verification Commands

```bash
# Frontend
cd apps/web && pnpm lint && pnpm typecheck && pnpm test

# Backend
cd services/api && ruff check . && mypy src/ && pytest

# Full monorepo
pnpm turbo test lint typecheck
```

## Environment Variables

```env
# Polymarket (NEVER commit these)
POLYMARKET_PRIVATE_KEY=         # Ethereum wallet private key
POLYMARKET_API_KEY=             # CLOB API key
POLYMARKET_API_SECRET=          # CLOB API secret
POLYMARKET_PASSPHRASE=          # CLOB API passphrase

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Backend only, never expose

# Trading controls
ENABLE_LIVE_TRADING=false       # MUST be explicit true to trade
PAPER_TRADING_BANKROLL=10000    # Virtual starting capital
MAX_POSITION_PCT=0.05           # 5% max per market
MAX_PORTFOLIO_PCT=0.30          # 30% total exposure
DAILY_STOP_LOSS_PCT=0.05        # 5% daily stop
DRAWDOWN_CIRCUIT_BREAKER=0.15   # 15% drawdown halts all trading
```

## Development Workflow — Local First

Code MUST be verified locally before it reaches any remote environment. This is enforced
through skills that trigger automatically. The workflow is: **code → test → commit → test → deploy**.

### Skills for Quality Gates

| Skill | Trigger | What It Does |
|-------|---------|--------------|
| `/local-testing` | After code changes, "run tests" | Runs lint + types + tests for affected layer(s) |
| `/pre-commit-verify` | Before `git commit` | Fast check: lint + types + tests on changed files + secret scan |
| `/pre-deploy-check` | Before `vercel --prod`, push to main, PR merge | Full gate: all checks + build + env vars + migrations + safety |
| `/write-backend-tests` | After writing Python code, "add tests" | Writes pytest tests following project patterns |
| `/write-frontend-tests` | After writing React/TS code, "test component" | Writes Vitest tests (includes framework setup if needed) |

### Mandatory Order

1. **Write code**
2. **Write tests** — use `/write-backend-tests` or `/write-frontend-tests`
3. **Run tests locally** — use `/local-testing`
4. **Commit** — `/pre-commit-verify` runs automatically (lint + types + secret scan)
5. **Deploy** — `/pre-deploy-check` runs automatically (full build + all checks)

### Before Every Commit
Run `/pre-commit-verify` or manually:
```bash
# Backend (if .py files changed)
cd services/api && ruff check src/ && mypy src/ --ignore-missing-imports && pytest tests/ -v

# Frontend (if .ts/.tsx files changed)
cd apps/web && pnpm lint && pnpm typecheck
```

### Before Every Deploy (push to main, vercel --prod, PR merge)
Run `/pre-deploy-check` or manually:
```bash
# Full backend
cd services/api && ruff check src/ && mypy src/ --ignore-missing-imports && pytest tests/ -v

# Full frontend including build
cd apps/web && pnpm lint && pnpm typecheck && pnpm build

# Or via turbo
pnpm turbo test lint typecheck
```

### After Any Code Change
Run `/local-testing` to test just the affected layer(s).

### Test Writing Standards
- **Every new function needs tests** — use `/write-backend-tests` or `/write-frontend-tests`
- **Backend tests**: pytest + unittest.mock, live in `services/api/tests/test_<module>.py`
- **Frontend tests**: Vitest + Testing Library, live next to source as `<file>.test.ts(x)`
- **Mock external services** (httpx, Supabase), never mock pure functions
- **Test happy path + edge cases + error cases** for every function
- **Tests must pass before commit** — no exceptions

### Rules
1. **Never push untested code** — all checks must pass locally first
2. **Never skip lint/type checks** — they catch real bugs, not just style
3. **Fix failures before proceeding** — don't commit with known failures
4. **Run the narrowest scope first** — test only what changed, then widen if needed
5. **Build verification before deploy** — `pnpm build` must succeed before any Vercel deploy
6. **New code needs new tests** — proactively write tests after implementing features

## Critical Safety Rules

1. **Never commit private keys or API secrets** — use env vars only
2. **Paper trading is default** — three independent flags must be true for live trading
3. **Kill switch**: set `ENABLE_LIVE_TRADING=false` to immediately halt new orders
4. **Position limits are hard-coded** — changing them requires a code review
5. **All strategies must implement `dry_run` mode** that logs but doesn't execute
6. **Rate limit backoff is mandatory** — respect Polymarket's 9000/10s CLOB limit
7. **Never auto-approve trades without human review** in semi-automated mode

## Orderbook Tracking Pipeline

The platform continuously tracks full orderbook depth for weather markets (EU + US):

### Webhook Endpoints (triggered by n8n)
- `POST /webhook/discover-weather-markets` — discovers weather markets across 20 EU capitals + 16 US cities (every 30 min)
- `POST /webhook/snapshot-orderbooks` — fetches full orderbook for all active weather markets (every 1 min)

### Query Endpoints
- `GET /markets/weather?region=europe&city=amsterdam` — list weather markets by region/city
- `GET /markets/{id}/orderbook` — latest orderbook snapshot (YES + NO)
- `GET /markets/{id}/orderbook/history?hours=24&side=YES&interval_minutes=5` — time-series with downsampling

### Supabase Tables
- `orderbook_snapshots` — full bid/ask depth as JSONB + pre-computed summary (best_bid, best_ask, mid_price, spread, depth)
- `markets.city` / `markets.region` — classified city and region for filtering

### European Capitals Tracked
Amsterdam, London, Paris, Berlin, Madrid, Rome, Lisbon, Brussels, Vienna, Zurich, Stockholm, Copenhagen, Oslo, Helsinki, Warsaw, Prague, Budapest, Athens, Dublin, Bucharest

### Data Volume
~30-90K rows/day at 1-min intervals. Plan retention policy: 5-min samples after 7 days, hourly after 30 days.

## Key URLs

- Polymarket CLOB API: `https://clob.polymarket.com`
- Polymarket Gamma API: `https://gamma-api.polymarket.com`
- Polymarket Data API: `https://data-api.polymarket.com`
- Open-Meteo Ensemble: `https://ensemble-api.open-meteo.com/v1/ensemble`
- Open-Meteo Historical: `https://archive-api.open-meteo.com/v1/archive`
- py-clob-client docs: `https://github.com/Polymarket/py-clob-client`
- Polymarket API docs: `https://docs.polymarket.com`
