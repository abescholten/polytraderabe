---
name: trader-frontend
description: >
  Next.js React dashboard builder for the Polymarket trading platform. Covers the algorithm
  overview, signal viewer, trade approval interface, portfolio tracker, performance charts,
  backtesting UI, and real-time market monitoring. Use this skill whenever building or modifying
  any frontend page, component, or UI element in the trading dashboard. Trigger on: "dashboard",
  "frontend", "component", "page", "chart", "UI", "React", "Next.js", "algorithm view",
  "portfolio", "performance", "signal list", "trade approval", "market monitor", or any task
  involving the web interface. When in doubt, trigger it.
---

# Trader Frontend

You are a Next.js dashboard specialist for a prediction market trading platform. The dashboard
lets the user monitor algorithms, review signals, approve trades, and analyze performance.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15+ | App Router, React Server Components |
| React | 19 | UI components |
| TypeScript | 5.x | Strict mode, no `any` |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | latest | Component library (cards, tables, dialogs, badges) |
| Recharts | 2.x | Charts (line, bar, area, scatter for calibration) |
| Supabase JS | 2.x | Real-time subscriptions, data fetching |
| Lucide React | latest | Icons |

## App Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx                 # Root layout with sidebar nav
│   ├── page.tsx                   # Dashboard overview
│   ├── algorithms/
│   │   ├── page.tsx               # All algorithms by category
│   │   └── [strategy]/page.tsx    # Single algorithm detail
│   ├── signals/
│   │   ├── page.tsx               # Pending signals + history
│   │   └── [id]/page.tsx          # Signal detail + approval
│   ├── portfolio/
│   │   ├── page.tsx               # Active positions + P&L
│   │   └── history/page.tsx       # Closed trades
│   ├── markets/
│   │   ├── page.tsx               # Market scanner / browser
│   │   └── [id]/page.tsx          # Single market detail
│   ├── backtesting/
│   │   ├── page.tsx               # Run backtests
│   │   └── results/[id]/page.tsx  # Backtest results
│   └── settings/page.tsx          # Risk limits, API config, mode toggle
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx            # Navigation sidebar
│   │   ├── header.tsx             # Top bar with mode indicator
│   │   └── mode-badge.tsx         # PAPER / LIVE indicator (always visible)
│   ├── dashboard/
│   │   ├── portfolio-summary.tsx  # Total value, daily P&L, exposure
│   │   ├── active-signals.tsx     # Signals awaiting approval
│   │   ├── recent-trades.tsx      # Last 10 trades
│   │   └── strategy-health.tsx    # Per-strategy Brier + ROI
│   ├── algorithms/
│   │   ├── strategy-card.tsx      # Algorithm overview card
│   │   ├── strategy-detail.tsx    # Full algorithm view
│   │   └── category-filter.tsx    # Filter by: weather, politics, etc.
│   ├── signals/
│   │   ├── signal-card.tsx        # Signal with approve/reject buttons
│   │   ├── signal-detail.tsx      # Full signal analysis
│   │   └── approval-dialog.tsx    # Confirmation dialog
│   ├── charts/
│   │   ├── pnl-chart.tsx          # Cumulative P&L over time
│   │   ├── calibration-chart.tsx  # Calibration scatter plot
│   │   ├── edge-distribution.tsx  # Histogram of predicted edges
│   │   └── brier-trend.tsx        # Rolling Brier score
│   ├── portfolio/
│   │   ├── positions-table.tsx    # Active positions with live prices
│   │   ├── exposure-gauge.tsx     # Portfolio exposure vs limits
│   │   └── risk-dashboard.tsx     # Circuit breaker status, limits
│   └── common/
│       ├── probability-badge.tsx  # Color-coded probability display
│       ├── edge-indicator.tsx     # Green/red edge visualization
│       ├── market-link.tsx        # Link to Polymarket market page
│       └── time-remaining.tsx     # Countdown to market resolution
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server component client
│   │   └── realtime.ts            # Subscription hooks
│   ├── api/
│   │   └── trading-api.ts         # Fetch wrapper for Python backend
│   └── utils/
│       ├── format.ts              # Number, currency, percentage formatting
│       └── colors.ts              # Edge/probability → color mapping
└── types/
    ├── market.ts
    ├── signal.ts
    ├── trade.ts
    └── strategy.ts
```

## Design Language

### Color Palette

This is a **trading dashboard** — prioritize clarity and data density over decoration.

```css
:root {
  /* Base */
  --bg-primary: #0f1117;         /* Dark background */
  --bg-secondary: #1a1d27;       /* Card/panel background */
  --bg-tertiary: #242835;        /* Hover, active states */
  --border: #2e3240;             /* Subtle borders */

  /* Text */
  --text-primary: #e8eaed;       /* Primary text */
  --text-secondary: #9ca3af;     /* Secondary, labels */
  --text-muted: #6b7280;         /* Disabled, hints */

  /* Trading colors */
  --green: #22c55e;              /* Profit, positive edge, YES */
  --green-muted: #16a34a33;      /* Green background wash */
  --red: #ef4444;                /* Loss, negative edge, NO */
  --red-muted: #ef444433;        /* Red background wash */
  --amber: #f59e0b;              /* Warning, pending, caution */
  --blue: #3b82f6;               /* Info, neutral, links */

  /* Mode indicators */
  --paper-mode: #f59e0b;         /* Amber — PAPER TRADING */
  --live-mode: #ef4444;          /* Red — LIVE TRADING (attention!) */
}
```

### Dark Mode Only

Trading dashboards are dark mode. Do not implement light mode. This reduces eye strain during
extended monitoring and makes chart colors pop against the background.

### Typography

```css
/* Use Inter for everything — it's designed for data-dense UIs */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;  /* For numbers, prices, code */
```

Use monospace for ALL numerical data: prices, probabilities, P&L, percentages. This ensures
columns align and numbers are instantly scannable.

### Component Patterns

**Mode Badge (ALWAYS visible)**:
```tsx
function ModeBadge() {
  const isPaper = !isLiveTradingEnabled()
  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 text-center py-1 text-sm font-bold tracking-wider",
      isPaper ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400 animate-pulse"
    )}>
      {isPaper ? "📋 PAPER TRADING" : "🔴 LIVE TRADING"}
    </div>
  )
}
```
This must be visible on EVERY page. Never hide it. Never make it dismissible.

**Probability Badge**:
```tsx
function ProbabilityBadge({ value }: { value: number }) {
  const color = value > 0.7 ? 'text-green-400' : value > 0.3 ? 'text-amber-400' : 'text-red-400'
  return <span className={cn("font-mono font-bold", color)}>{(value * 100).toFixed(1)}%</span>
}
```

**Edge Indicator**:
```tsx
function EdgeIndicator({ edge }: { edge: number }) {
  const isPositive = edge > 0
  return (
    <span className={cn(
      "font-mono text-sm",
      isPositive ? "text-green-400" : "text-red-400"
    )}>
      {isPositive ? "+" : ""}{(edge * 100).toFixed(1)}%
    </span>
  )
}
```

## Key Pages

### Dashboard (/)

Overview with four quadrants:
1. **Portfolio Summary** — Total value, daily P&L (number + sparkline), total exposure gauge
2. **Active Signals** — Count of pending approvals with urgency indicator
3. **Recent Trades** — Last 5 trades with outcome badges
4. **Strategy Health** — Card per strategy: name, Brier score, ROI, trade count

### Algorithms (/algorithms)

Grid of strategy cards, filterable by category (weather, politics, sports, crypto).
Each card shows: name, description, status (active/paused), Brier score, ROI, total trades,
last signal time.

### Algorithm Detail (/algorithms/[strategy])

Full page for a single algorithm with tabs:
- **Signals** — All historical signals with outcomes
- **Performance** — P&L chart, Brier trend, calibration plot
- **Configuration** — Editable parameters (min edge, Kelly fraction, markets to scan)
- **Backtest** — Run or view backtests for this strategy

### Signals (/signals)

Two sections:
1. **Pending Approval** — Cards with: market question, our probability vs market price,
   edge, recommended size, risk check status, APPROVE / REJECT buttons
2. **Signal History** — Table of all past signals with filters

### Signal Approval (/signals/[id])

Detailed view showing:
- Market question and link to Polymarket
- Our probability breakdown (per model: ECMWF, GFS, ICON)
- Market price history chart
- Edge calculation explanation
- Position sizing breakdown (Kelly, caps applied)
- Risk check results (all green/red)
- Large APPROVE / REJECT buttons with confirmation dialog

### Portfolio (/portfolio)

Active positions table with live price updates (via Supabase real-time):
- Market question
- Side (YES/NO) with color
- Entry price vs current price
- Unrealized P&L
- Time to resolution
- Close/cancel button

Plus: exposure gauge showing current vs max portfolio limit.

## Real-Time Updates

Use Supabase Realtime for live dashboard updates:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function useRealtimeSignals() {
  const [signals, setSignals] = useState<Signal[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    supabase.from('signals').select('*').eq('status', 'pending').then(({ data }) => {
      if (data) setSignals(data)
    })

    // Real-time subscription
    const channel = supabase
      .channel('signals')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'signals',
        filter: 'status=eq.pending',
      }, (payload) => {
        // Update signals list
        if (payload.eventType === 'INSERT') {
          setSignals(prev => [payload.new as Signal, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setSignals(prev => prev.map(s => s.id === payload.new.id ? payload.new as Signal : s))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return signals
}
```

## Charts

### Calibration Plot (critical for strategy evaluation)

```tsx
import { ScatterChart, Scatter, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip } from 'recharts'

function CalibrationChart({ data }: { data: { predicted: number, observed: number, count: number }[] }) {
  return (
    <ScatterChart width={500} height={400}>
      <CartesianGrid strokeDasharray="3 3" stroke="#2e3240" />
      <XAxis dataKey="predicted" domain={[0, 1]} label="Predicted Probability" stroke="#9ca3af" />
      <YAxis dataKey="observed" domain={[0, 1]} label="Observed Frequency" stroke="#9ca3af" />
      {/* Perfect calibration line */}
      <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#3b82f6" strokeDasharray="5 5" />
      <Scatter data={data} fill="#22c55e" />
      <Tooltip />
    </ScatterChart>
  )
}
```

## API Communication

All dashboard data flows through the Python FastAPI backend:

```typescript
// lib/api/trading-api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

export const tradingApi = {
  // Signals
  getSignals: (status?: string) =>
    fetch(`${API_BASE}/signals${status ? `?status=${status}` : ''}`).then(r => r.json()),

  approveSignal: (id: string) =>
    fetch(`${API_BASE}/signals/${id}/approve`, { method: 'POST' }).then(r => r.json()),

  rejectSignal: (id: string, reason: string) =>
    fetch(`${API_BASE}/signals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }).then(r => r.json()),

  // Strategies
  getStrategies: () =>
    fetch(`${API_BASE}/strategies`).then(r => r.json()),

  // Portfolio
  getPositions: () =>
    fetch(`${API_BASE}/portfolio/positions`).then(r => r.json()),

  getPerformance: (strategy?: string, period?: string) =>
    fetch(`${API_BASE}/portfolio/performance?strategy=${strategy || 'all'}&period=${period || '30d'}`).then(r => r.json()),

  // Backtesting
  runBacktest: (strategy: string, startDate: string, endDate: string) =>
    fetch(`${API_BASE}/backtesting/run`, {
      method: 'POST',
      body: JSON.stringify({ strategy, start_date: startDate, end_date: endDate })
    }).then(r => r.json()),
}
```

## Safety Rules

1. **Mode badge is ALWAYS visible** — paper or live, never hidden, never dismissible
2. **Trade approval requires confirmation dialog** — no single-click execution
3. **Live mode switch requires typed confirmation** — "I understand this uses real funds"
4. **All monetary values show currency** — never ambiguous numbers
5. **Charts default to paper trading data** — clearly label when showing live data
6. **Error states are visible** — API failures, stale data, disconnected real-time shown prominently
