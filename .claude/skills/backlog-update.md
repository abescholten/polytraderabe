---
name: backlog-update
description: >
  Standard process for adding, updating, prioritizing, and reviewing items in
  docs/backlog/BACKLOG.md. Use this whenever completing work, discovering improvements,
  identifying bugs, or planning new features. Trigger on: "update backlog", "add to backlog",
  "backlog item", "what's on the backlog", "prioritize", "what should we work on next",
  "discovered improvement", "found a bug", "new feature idea", "technical debt",
  or any time work is completed and follow-up items should be captured.
  Always run this AFTER completing any feature or review.
---

# Backlog Update

The backlog lives at `docs/backlog/BACKLOG.md`. It is the single source of truth for all
planned work. Everything that should be built, fixed, or improved goes here — nothing is kept
in memory or scattered across notes.

## When to Run This Skill

**After completing any work:**
- You just implemented a feature → add follow-up items you noticed
- You ran a test and found edge cases → add items for handling them
- You reviewed algorithms → add calibration/improvement items

**When you discover something:**
- A bug or fragile code path → add P1 or P2 item
- A missing test → add to backlog
- A performance concern → add P2/P3 item
- An API limitation you worked around → add for proper handling later

**Proactively, every session:**
- Before starting work: read the backlog, confirm priorities
- After finishing work: add any new ideas generated during implementation

## Backlog File Location

```
docs/backlog/BACKLOG.md
```

## Standard Item Format

When adding a new row to BACKLOG.md:

```markdown
| P[1/2/3] | [Short description — what needs to happen] | [Why — one sentence context] | [Optional: link to plan] |
```

**Priority guide:**

| Priority | Meaning |
|---|---|
| **P1** | Broken, blocking, or critical for next milestone |
| **P2** | Important, should happen in next 2-3 sessions |
| **P3** | Nice to have, low urgency, revisit later |

## How to Add Items

### Step 1: Read the current backlog

```bash
cat docs/backlog/BACKLOG.md
```

Check: does the item already exist? If yes, update priority instead of adding a duplicate.

### Step 2: Choose the right section

Sections in BACKLOG.md:

- **🌦 Weather Data** — data sources, variables, city coverage, algorithm quality
- **📊 Trading Engine** — Kelly sizing, strategy execution, signal generation, risk controls
- **🖥 Dashboard / UI** — charts, components, user interface features
- **🤖 Agents** — Claude skills, n8n workflows, automated agents
- **🔧 Infrastructure** — database, CI/CD, deployment, tooling

If an item doesn't fit cleanly, add it to the closest section and note the cross-cutting concern.

### Step 3: Write a good item

**Good backlog item:**
```
| P2 | Seasonal climatology baseline per city | Bayesian prior needs historical base rates — without this, bayesian_blend has no prior | — |
```

**Bad backlog item:**
```
| P2 | Improve algorithm | Things could be better | — |
```

A good item has:
- A clear verb (add, fix, implement, investigate, replace, remove)
- The specific thing to change
- A one-sentence "why" so future-you understands context

### Step 4: Set priority honestly

Ask yourself:
- P1: "Would a broken version of this block me from making money?"
- P2: "Would I be embarrassed to show this to someone who knows trading systems?"
- P3: "Would I build this if I had a free afternoon?"

### Step 5: Add to the file

Edit `docs/backlog/BACKLOG.md` directly. Add the row in priority order within the section (P1s first, then P2s, then P3s).

## Completing Items

When an item is done, mark it in one of two ways:

**For small completions:** Remove the row from the active section and add to the Done section at the bottom.

**For large completions (full feature):** Move to `docs/backlog/done/YYYY-MM.md` to keep BACKLOG.md concise.

## Project Management Mindset

Running this skill isn't just bookkeeping — it's how you guide the project. Ask yourself after every session:

### Mandatory questions after any code change:
1. **What did I learn that wasn't in the spec?** → Add discovered edge cases
2. **What did I cut to keep scope small?** → Add deferred items at P2/P3
3. **What would make this 20% better without much effort?** → Add at P3
4. **What would break this in production?** → Add P1 items for robustness

### Mandatory questions after any algorithm review:
1. **Which algorithm is underperforming?** → P1 to fix if failing, P2 if marginal
2. **What data would improve accuracy?** → P2 for data sources
3. **What market types are we missing?** → P2 for new strategies
4. **Is any infrastructure at risk?** → P1 for stability items

## Full Review Cadence

Once per major session (when you have extra tokens):

```
[ ] Read full BACKLOG.md
[ ] Are P1 items actually P1? De-prioritize anything that's been P1 for 3+ sessions without action
[ ] Are any P3 items now irrelevant? Remove them
[ ] Are there patterns across P2 items that suggest a bigger initiative?
[ ] Does the backlog reflect the current project state accurately?
```

## Example: After Implementing the City Registry (Task 1)

After completing Task 1 from the weather foundation plan, you'd add:

```markdown
| P3 | Add timezone to City dataclass | Useful for local-time market resolution logic | — |
| P2 | City coverage for Asia/Pacific markets | Polymarket has Tokyo/Sydney weather markets | — |
| P3 | City name fuzzy matching (Levenshtein) | "Amsterdm" typo in market question fails lookup | — |
```

## Safety Rules

1. **Never delete items without completing them** — mark done, don't silently remove
2. **One item per row** — don't bundle unrelated things together
3. **Be honest with priority** — P1 inflation makes the backlog useless
4. **Don't backlog what you can fix in 5 minutes** — just fix it
5. **The backlog is for the human too** — write it so the human can read it and set direction
