---
name: trader-deployment
description: >
  Deployment and CI/CD specialist for the trading platform — covering Vercel configuration,
  GitHub repo setup, GitHub Actions, environment management, monitoring, error logs, and
  the optional Railway trading engine service. Trigger on: "deploy", "Vercel", "GitHub",
  "CI/CD", "pipeline", "environment", "env vars", "monitoring", "logs", "error", "Railway",
  "production", "preview", "branch", "release", "rollback", or any task involving getting
  code to production or troubleshooting deployments. When in doubt, trigger it.
---

# Trader Deployment

You are a deployment specialist. The platform deploys to Vercel (frontend + serverless API)
with Supabase (database) and optionally Railway (persistent trading engine). GitHub is the
single source of truth with automated CI/CD.

## Deployment Architecture

```
GitHub (main branch)
    │
    ├──▶ Vercel (auto-deploy)
    │      ├── Next.js Dashboard (apps/web)
    │      ├── Python API Functions (services/api → api/)
    │      └── Cron Jobs (scan signals, sync prices)
    │
    ├──▶ Supabase (migrations via CLI)
    │      ├── PostgreSQL Database
    │      ├── Realtime Subscriptions
    │      └── Auth (if needed later)
    │
    └──▶ Railway (optional, manual deploy)
           └── Persistent Python Trading Engine
               ├── WebSocket connections
               └── Real-time signal processing
```

## GitHub Repository Setup

### Initial Setup Commands (Claude Code)

```bash
# Initialize repo
mkdir polymarket-trader && cd polymarket-trader
git init
gh repo create abescholten/polymarket-trader --private --source=. --remote=origin

# Monorepo setup
pnpm init
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'services/*'
EOF

# Turborepo
pnpm add -D turbo

# Next.js app
cd apps && npx create-next-app@latest web --typescript --tailwind --app --src-dir --import-alias "@/*"
cd ..

# Python backend
mkdir -p services/api/src/{api,trading,data,models,db}
mkdir -p services/api/tests
cd services/api
python -m venv .venv
pip install fastapi mangum supabase httpx py-clob-client pydantic numpy

# Supabase
supabase init

# Push to GitHub
git add -A
git commit -m "Initial project structure"
git push -u origin main
```

### Branch Strategy

```
main          ← production (auto-deploys to Vercel)
├── develop   ← integration branch
├── feat/*    ← feature branches (get Vercel preview URLs)
└── fix/*     ← bug fixes
```

### .gitignore

```gitignore
# Dependencies
node_modules/
.venv/
__pycache__/

# Environment
.env
.env.local
.env.production

# Build
.next/
.vercel/
.turbo/
dist/

# IDE
.vscode/
.idea/

# Secrets — NEVER commit
*.key
*.pem
wallet.json
```

## Vercel Configuration

### vercel.json

```json
{
  "buildCommand": "cd apps/web && pnpm build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/main.py"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/scan-signals",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/sync-prices",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/check-resolutions",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/expire-signals",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Vercel Project Setup (CLI)

```bash
# Link project to Vercel
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add POLYMARKET_PRIVATE_KEY production
vercel env add POLYMARKET_API_KEY production
vercel env add POLYMARKET_API_SECRET production
vercel env add POLYMARKET_PASSPHRASE production
vercel env add CRON_SECRET production
vercel env add ENABLE_LIVE_TRADING production  # Set to "false"

# Deploy
vercel --prod

# Or let GitHub integration handle it (preferred)
```

### Vercel GitHub Integration

Once connected, Vercel automatically:
- Deploys `main` branch to production
- Creates preview deployments for every PR
- Runs build checks before merge
- Provides preview URLs for testing

## GitHub Actions

### CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: cd apps/web && pnpm lint
      - run: cd apps/web && pnpm typecheck
      - run: cd apps/web && pnpm test -- --passWithNoTests

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r services/api/requirements.txt
      - run: pip install ruff mypy pytest
      - run: cd services/api && ruff check src/
      - run: cd services/api && mypy src/ --ignore-missing-imports
      - run: cd services/api && pytest tests/ -v
```

### Database Migration Pipeline

```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Environment Management

### Three Environments

| Environment | Vercel | Supabase | Purpose |
|------------|--------|----------|---------|
| Development | `vercel dev` (local) | Local or dev branch | Local development |
| Preview | Auto per PR | Linked Supabase project | PR testing |
| Production | `main` branch | Production project | Live dashboard |

### Secret Rotation

```bash
# Rotate Polymarket API creds
vercel env rm POLYMARKET_API_KEY production
vercel env add POLYMARKET_API_KEY production
# Redeploy to pick up new value
vercel --prod
```

## Monitoring & Logs

### Vercel Logs (Claude Code access)

```bash
# View recent function logs
vercel logs --follow

# Filter by function path
vercel logs --follow --filter="api/cron/scan-signals"

# View deployment errors
vercel inspect <deployment-url>
```

### Supabase Logs

```bash
# View Postgres logs
supabase db logs --project-ref <ref>

# View Edge Function logs (if used)
supabase functions logs <function-name> --project-ref <ref>
```

### Health Check Endpoint

```python
# api/health.py
@app.get("/api/health")
async def health():
    checks = {}

    # Database
    try:
        db = get_supabase()
        db.table("markets").select("id").limit(1).execute()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"

    # Polymarket API
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://clob.polymarket.com/time", timeout=5)
            checks["polymarket"] = "ok" if resp.status_code == 200 else f"status: {resp.status_code}"
    except Exception as e:
        checks["polymarket"] = f"error: {str(e)}"

    # Open-Meteo
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.open-meteo.com/v1/forecast?latitude=52&longitude=5&hourly=temperature_2m&forecast_days=1", timeout=5)
            checks["open_meteo"] = "ok" if resp.status_code == 200 else f"status: {resp.status_code}"
    except Exception as e:
        checks["open_meteo"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "trading_mode": "paper" if os.environ.get("ENABLE_LIVE_TRADING") != "true" else "LIVE",
    }
```

## Claude Code Deployment Commands

Commands Claude Code should use for deployment tasks:

```bash
# Deploy to production
vercel --prod

# Deploy preview (for testing)
vercel

# View deployment status
vercel ls

# View function logs
vercel logs --follow

# Run database migration
supabase db push --project-ref $SUPABASE_PROJECT_REF

# Check cron job execution
vercel logs --filter="api/cron"

# Rollback to previous deployment
vercel rollback

# View environment variables (names only, not values)
vercel env ls
```

## Railway Setup (Optional — Trading Engine)

For persistent WebSocket connections and real-time signal processing:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init

# Deploy Python service
railway up --service trading-engine

# Set environment variables
railway variables set POLYMARKET_PRIVATE_KEY=xxx
railway variables set SUPABASE_URL=xxx
railway variables set ENABLE_LIVE_TRADING=false
```

Railway Dockerfile:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY services/engine/ .
RUN pip install -r requirements.txt
CMD ["python", "-m", "src.main"]
```

## Safety Rules

1. **Production deploys only from main** — never force-push, always PR + merge
2. **Secrets are Vercel env vars** — never in code, never in .env files committed to git
3. **Preview deployments share no secrets** — use separate test keys for previews
4. **Cron secret prevents external triggers** — always verify Authorization header
5. **Database migrations are append-only** — never edit existing migrations
6. **Rollback plan**: `vercel rollback` for frontend, manual migration revert for DB
7. **Kill switch accessible via env var** — `vercel env add ENABLE_LIVE_TRADING production` → set to `false`
