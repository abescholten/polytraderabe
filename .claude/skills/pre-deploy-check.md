---
name: pre-deploy-check
description: >
  Full pre-deployment verification checklist. MUST be triggered BEFORE any deployment to
  Vercel (preview or production), before `vercel --prod`, `vercel deploy`, `git push` to
  main, or PR merge to main. Trigger on: "deploy", "push to production", "go live",
  "ship it", "merge to main", "vercel --prod", or any action that sends code to a remote
  environment. This skill BLOCKS deployment until all checks pass.
---

# Pre-Deployment Verification

You are a deployment gatekeeper. NOTHING gets deployed until every check below passes.
This is non-negotiable — a failed check means the deploy is blocked.

## Pre-Flight Checklist

Run these checks in order. Stop at the first failure.

### 1. Git Status — Clean Working Tree

```bash
git status
```

- **Must**: No uncommitted changes, no untracked files that should be committed
- **Action on fail**: Commit or stash changes first

### 2. Backend Checks (services/api)

```bash
# Lint
cd services/api && ruff check src/

# Type check
cd services/api && mypy src/ --ignore-missing-imports

# Tests
cd services/api && pytest tests/ -v

# Import verification — app must boot
cd services/api && python -c "from src.main import app; print('OK')"
```

- **Must**: All four pass with zero errors
- **Action on fail**: Fix errors before proceeding

### 3. Frontend Checks (apps/web)

```bash
# Lint
cd apps/web && pnpm lint

# Type check (if configured)
cd apps/web && pnpm typecheck 2>/dev/null || echo "typecheck not configured"

# Build — this is the ultimate frontend verification
cd apps/web && pnpm build
```

- **Must**: Lint clean, build succeeds
- **Action on fail**: Fix lint/build errors

### 4. Environment Variables

```bash
# Check that required env vars are set in Vercel
vercel env ls
```

Verify these are present:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENABLE_LIVE_TRADING` (must be `false` unless explicitly authorized)

### 5. Database Migrations

```bash
# Check for unapplied migrations
ls supabase/migrations/
```

- If new migrations exist that haven't been pushed to Supabase, they must be applied
  BEFORE deploying code that depends on them
- Run `supabase db push` if needed

### 6. Safety Verification (for trading-related changes)

If the deploy includes changes to trading logic, execution, or risk management:

- [ ] `ENABLE_LIVE_TRADING` is `false` in production env
- [ ] Paper trading mode is the default path
- [ ] Position limits are unchanged (or change was reviewed)
- [ ] No hardcoded API keys or secrets in the diff
- [ ] Kill switch still works

```bash
# Scan for accidental secret exposure
git diff --cached | grep -i -E "(private_key|api_secret|passphrase|password)" || echo "No secrets found"
```

## Deployment Decision

After all checks pass, present the verdict:

```
## Pre-Deploy Verdict

| Check               | Status |
|---------------------|--------|
| Git clean           | PASS   |
| Backend lint        | PASS   |
| Backend types       | PASS   |
| Backend tests       | PASS   |
| Backend imports     | PASS   |
| Frontend lint       | PASS   |
| Frontend build      | PASS   |
| Env vars present    | PASS   |
| Migrations applied  | PASS   |
| Safety check        | PASS   |

ALL CHECKS PASSED — safe to deploy.
```

Only after ALL checks pass, proceed with:
- **Preview deploy**: `vercel` (for PR testing)
- **Production deploy**: `vercel --prod` (only from main branch)

## If a Check Fails

1. **Do NOT deploy** — no exceptions
2. Report which check failed and why
3. Offer to fix the issue (auto-fix for lint, manual guidance for others)
4. Re-run the full checklist after the fix
5. Only deploy once everything is green
