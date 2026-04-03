---
name: pre-commit-verify
description: >
  Quick code quality verification before committing. Runs lint and type checks on changed
  files only. Trigger on: "commit", "git commit", "ready to commit", "save my changes",
  or any action that creates a git commit. This is lighter than pre-deploy-check — it
  focuses on the files being committed, not the full build.
---

# Pre-Commit Verification

You are a commit gatekeeper. Before any `git commit`, verify that the changed code passes
quality checks. This is a fast, focused check — not a full build.

## Step 1: Identify Changed Files

```bash
# Staged files (about to be committed)
git diff --cached --name-only

# Unstaged changes (might need to be staged first)
git diff --name-only
```

Classify changes:
- **Python files** (`.py`) → run backend checks
- **TypeScript/React files** (`.ts`, `.tsx`) → run frontend checks
- **SQL migrations** (`.sql`) → flag for review
- **Config files** (`vercel.json`, `package.json`, etc.) → note but no test needed

## Step 2: Run Targeted Checks

### If Python files changed:

```bash
# Lint only changed files
cd services/api && ruff check src/

# Type check
cd services/api && mypy src/ --ignore-missing-imports

# Run tests related to changed code
cd services/api && pytest tests/ -v --timeout=30
```

### If TypeScript/React files changed:

```bash
# Lint
cd apps/web && pnpm lint

# Type check
cd apps/web && pnpm typecheck 2>/dev/null || echo "typecheck not configured"
```

### If SQL migrations changed:

- Verify the migration file is well-formed SQL
- Check it's append-only (no editing existing migrations)
- Warn if it contains destructive operations (DROP, TRUNCATE, DELETE)

## Step 3: Security Scan

```bash
# Check for secrets in staged files
git diff --cached | grep -i -E "(private_key|api_secret|passphrase|password|sk_live|sk_test)" || echo "No secrets detected"
```

If secrets are found: **BLOCK the commit** and warn the user.

## Step 4: Report and Proceed

```
## Commit Readiness

| Check            | Status | Scope        |
|------------------|--------|--------------|
| Python lint      | PASS   | 3 files      |
| Python types     | PASS   | src/         |
| Python tests     | PASS   | 8 passed     |
| Secret scan      | PASS   |              |

Ready to commit.
```

## Rules

1. **Never skip checks** — even for "small" changes
2. **Auto-fix when possible** — `ruff check --fix`, `pnpm lint --fix`
3. **Block on test failures** — a failing test means the commit waits
4. **Block on secrets** — no exceptions, ever
5. **Don't run full build** — that's for pre-deploy, not pre-commit
6. **Be fast** — this should take <30 seconds for most changes
