---
name: write-frontend-tests
description: >
  Write TypeScript unit tests for frontend code (apps/web). Trigger on: "write frontend
  tests", "test component", "test the frontend", "add React tests", "vitest", "jest",
  or when new TypeScript/React code has been written that lacks tests. Proactively trigger
  after implementing new frontend functionality. Also handles initial test framework setup.
---

# Write Frontend Tests

You are a TypeScript test writer for the PolyTrader frontend (Next.js + React 19).

## Test Framework Setup

The frontend currently has **no test framework configured**. Before writing any tests,
check if setup is needed:

```bash
cd apps/web && cat package.json | grep -E "vitest|jest|testing-library"
```

### If no test framework exists, set up Vitest:

```bash
cd apps/web && pnpm add -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `apps/web/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

Add test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## Test Writing Rules

### 1. What to Test

| Type | Location | How to Test |
|------|----------|-------------|
| Utility functions | `src/lib/utils.ts`, `src/lib/utils/` | Direct import, test pure logic |
| API client functions | `src/lib/api/` | Mock fetch/supabase, test transforms |
| React components | `src/components/` | Render with Testing Library, assert DOM |
| Hooks | `src/hooks/` | renderHook from Testing Library |

### 2. Test File Location

Tests live next to the source file:

```
src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts          ← test file
├── components/
│   ├── dashboard/
│   │   ├── MarketCard.tsx
│   │   └── MarketCard.test.tsx ← test file
```

### 3. Utility Function Tests

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('deduplicates tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })
})
```

### 4. API Client Tests

```typescript
// src/lib/api/markets.test.ts
import { describe, it, expect, vi } from 'vitest'
import { fetchMarkets } from './markets'

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: [{ id: '1', question: 'Will it rain?' }],
          error: null,
        }),
      }),
    }),
  },
}))

describe('fetchMarkets', () => {
  it('returns market data', async () => {
    const markets = await fetchMarkets({ city: 'amsterdam' })
    expect(markets).toHaveLength(1)
    expect(markets[0].question).toBe('Will it rain?')
  })
})
```

### 5. React Component Tests

```typescript
// src/components/dashboard/MarketCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketCard } from './MarketCard'

describe('MarketCard', () => {
  const mockMarket = {
    id: '1',
    question: 'Will Amsterdam exceed 25°C?',
    price: 0.65,
  }

  it('renders the market question', () => {
    render(<MarketCard market={mockMarket} />)
    expect(screen.getByText('Will Amsterdam exceed 25°C?')).toBeInTheDocument()
  })

  it('displays the price', () => {
    render(<MarketCard market={mockMarket} />)
    expect(screen.getByText('65%')).toBeInTheDocument()
  })
})
```

### 6. Test Naming Convention

```
describe('<ModuleName>', () => {
  it('<does something specific>', () => { ... })
})
```

Examples:
- `it('returns null when API returns 500')`
- `it('renders loading state while fetching')`
- `it('converts Celsius to Fahrenheit correctly')`

### 7. Priority Modules to Test

| Module | Why | Complexity |
|--------|-----|------------|
| `src/lib/utils.ts` | Utility functions, pure logic | Low |
| `src/lib/api/` | API clients, data transforms | Medium |
| `src/components/common/` | Reusable components | Medium |
| `src/components/dashboard/` | Core dashboard views | High |
| `src/components/weather/` | Weather data display | Medium |

### 8. Mocking Guidelines

- **Mock Supabase client** — never make real API calls in tests
- **Mock fetch/httpx** — use `vi.fn()` or `msw` for HTTP mocking
- **Don't mock React** — render real components with Testing Library
- **Don't mock pure functions** — test them directly

### 9. Running Tests

```bash
# Run all tests
cd apps/web && pnpm test

# Run specific test file
cd apps/web && pnpm vitest run src/lib/utils.test.ts

# Watch mode during development
cd apps/web && pnpm test:watch
```

**Tests MUST pass before considering the task done.**

## Step-by-Step Process

1. **Check if test framework is set up** — if not, install Vitest + Testing Library
2. **Read the source file** — understand the component/function
3. **Identify test cases** — happy path, edge cases, error states
4. **Write the test file** — next to the source file, follow patterns above
5. **Run the tests** — `pnpm test`
6. **Fix failures** — iterate until green
7. **Report coverage** — list what's now tested
