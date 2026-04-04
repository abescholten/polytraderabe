# PolyTrader Backlog

> Living document. Add items freely, reorder by priority, mark done. Group by area.

---

## 🌦 Weather Data

| Priority | Item | Notes | Plan |
|---|---|---|---|
| P1 | City registry (single source of truth) | Extract KNOWN_CITIES, 20 EU + 15 US cities | [2026-04-04-weather-data-foundation](../superpowers/plans/2026-04-04-weather-data-foundation.md) |
| P1 | Multi-variable forecasting (precipitation, wind) | Add to Open-Meteo fetches | [2026-04-04-weather-data-foundation](../superpowers/plans/2026-04-04-weather-data-foundation.md) |
| P1 | MeteoStat as second historical data source | Station-based validation alongside ERA5 | [2026-04-04-weather-data-foundation](../superpowers/plans/2026-04-04-weather-data-foundation.md) |
| P1 | KDE + Bayesian probability algorithms | More accurate than raw member counting | [2026-04-04-weather-data-foundation](../superpowers/plans/2026-04-04-weather-data-foundation.md) |
| P1 | Forecast calibration (Brier score, reliability) | Measure how accurate our probabilities are | [2026-04-04-weather-data-foundation](../superpowers/plans/2026-04-04-weather-data-foundation.md) |
| P1 | Real backtesting framework (historical replay) | Replace simplified simulation in weather_temp.py | [2026-04-04-weather-data-foundation](../superpowers/plans/2026-04-04-weather-data-foundation.md) |
| P2 | Seasonal climatology baseline | Per-city P(event) by month — Bayesian prior input | — |
| P2 | Precipitation probability strategy | Extend WeatherTemperatureStrategy to rainfall markets | — |
| P2 | Wind speed strategy | Markets about storm thresholds | — |
| P3 | DWD (German Weather Service) direct integration | Better resolution for Central Europe | — |
| P3 | ECMWF CDS API direct access | Full resolution ensemble, requires registration | — |

---

## 📊 Trading Engine

| Priority | Item | Notes |
|---|---|---|
| P2 | Kelly criterion position sizing | Based on edge + calibration confidence |
| P2 | Strategy registry API endpoint | `GET /strategies` + `GET /strategies/{name}/signals` |
| P2 | Live paper trading loop (n8n triggered) | Webhook → discover markets → generate signals → execute paper |
| P3 | Multi-strategy ensemble signal | Combine temperature + precipitation signals |
| P3 | Drawdown circuit breaker implementation | DRAWDOWN_CIRCUIT_BREAKER env var enforcement |

---

## 🖥 Dashboard / UI

| Priority | Item | Notes |
|---|---|---|
| P2 | Backtest results view | Show Brier score, win rate, calibration curve chart |
| P2 | Active signals panel | Live paper signals with edge + confidence |
| P2 | Weather forecast widget per city | Temperature distribution + threshold probability |
| P3 | Portfolio P&L chart (paper trading) | Equity curve over time |
| P3 | Calibration reliability diagram | Forecasted vs observed frequency scatter |

---

## 🤖 Agents & Skills

| Priority | Item | Notes |
|---|---|---|
| ✅ Done | `day-trader` skill | Algorithm analyst — reviews Brier, calibration, edge distribution |
| ✅ Done | `backlog-update` skill | Standard process for maintaining BACKLOG.md |
| ✅ Done | `market-scanner` skill | Polymarket discovery, filtering, ranking |
| ✅ Done | `signal-monitor` skill | Live signal checking, anomaly detection |
| ✅ Done | `architect` skill | Architecture review before implementation |
| ✅ Done | `supabase-queries` skill | Standard query patterns for all tables |
| ✅ Done | `performance-report` skill | Weekly review, calibration trend, go-live assessment |
| P2 | Day Trader n8n workflow | n8n workflow that calls signal-monitor + day-trader on schedule, posts summary somewhere visible |
| P3 | UI Designer Claude Code skill | Suggests component design, reviews dashboard changes — create when UI work starts |

---

## 🔧 Infrastructure

| Priority | Item | Notes |
|---|---|---|
| P2 | Data retention policy for orderbook_snapshots | 5-min samples >7d, hourly >30d (documented in CLAUDE.md) |
| P2 | Supabase migration for backtesting results table | Store BacktestResult records |
| P3 | GitHub Actions test matrix (Python 3.12 + Node 20) | Currently no CI test runner |

---

## Legend

- **P1** — Do now (next sprint)
- **P2** — Do soon (after P1 complete)
- **P3** — Nice to have / future
- **Done** — Completed (move to `docs/backlog/done/` when large)
