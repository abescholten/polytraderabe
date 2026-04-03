---
name: local-testing
description: >
  Run the full local test suite for frontend and/or backend before pushing or deploying.
  Trigger on: "run tests", "test locally", "check tests", "verify tests", "test suite",
  "does it pass", "run the checks", or any task where code has been changed and needs
  verification. Also trigger BEFORE any git push, vercel deploy, or PR creation.
  When in doubt, trigger it.
---

# Local Testing

You are a local test runner. Your job is to run all relevant tests locally and report
results BEFORE any code leaves the developer's machine. Nothing gets pushed or deployed
until tests pass.

## When to Run

- **Always** before `git push`, `git commit` (if tests exist), PR creation, or deployment
- After any code change that touches `.py`, `.ts`, `.tsx` files
- When the user asks to verify, test, or check their work
- When finishing a feature or bug fix

## Test Commands

### Frontend (apps/web)

```bash
# Lint — catches style issues and unused imports
cd apps/web && pnpm lint

# Type check — catches type errors without building
cd apps/web && pnpm typecheck

# Unit tests (if they exist)
cd apps/web && pnpm test 2>/dev/null || echo "No test script configured"

# Build — final verification that everything compiles
cd apps/web && pnpm build
```

### Backend (services/api)

```bash
# Lint — Ruff catches Python style and logic issues
cd services/api && ruff check src/

# Type check — mypy catches type errors
cd services/api && mypy src/ --ignore-missing-imports

# Unit tests — pytest runs all test files
cd services/api && pytest tests/ -v

# Import check — verify the app actually starts
cd services/api && python -c "from src.main import app; print('FastAPI app imports OK')"
```

### Full Monorepo (when both layers changed)

```bash
# If turbo is configured:
pnpm turbo test lint typecheck

# Otherwise run sequentially:
cd apps/web && pnpm lint && pnpm typecheck && pnpm build
cd services/api && ruff check src/ && mypy src/ --ignore-missing-imports && pytest tests/ -v
```

## Execution Rules

1. **Detect what changed** — use `git diff --name-only` to determine which layer(s) need testing
2. **Run the narrowest relevant suite first** — if only Python changed, skip frontend tests
3. **Run ALL checks for the affected layer** — don't skip lint just because tests pass
4. **Report results clearly** — show pass/fail per check, with error details for failures
5. **Block on failure** — if any check fails, do NOT proceed with push/deploy/commit
6. **Fix before continuing** — offer to fix lint/type errors automatically when possible

## Result Format

After running tests, report like this:

```
## Test Results

| Check          | Status | Details          |
|----------------|--------|------------------|
| Backend lint   | PASS   |                  |
| Backend types  | PASS   |                  |
| Backend tests  | PASS   | 12 passed        |
| Frontend lint  | FAIL   | 2 errors         |
| Frontend types | PASS   |                  |
| Frontend build | SKIP   | (blocked by lint)|

Verdict: BLOCKED — fix frontend lint errors before proceeding.
```

## Common Fixes

- **Ruff errors**: Run `ruff check src/ --fix` to auto-fix most issues
- **ESLint errors**: Run `pnpm lint --fix` for auto-fixable issues
- **Type errors**: These require manual fixes — read the error carefully
- **Import errors**: Check for missing dependencies in requirements.txt or package.json
- **Test failures**: Read the assertion error, check if it's a real bug or outdated test
