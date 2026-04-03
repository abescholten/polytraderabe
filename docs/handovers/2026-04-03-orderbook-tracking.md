# Handover: Weather Market Orderbook Tracking Pipeline

**Datum**: 2026-04-03
**Sessie**: Orderbook tracking voor Polymarket weather markets (EU + US)
**Branch**: `worktree-marketdata` (gemerged naar main via PR #1)

## Wat is gebouwd

Een pipeline die elke minuut het volledige orderbook ophaalt van alle actieve weather markets op Polymarket en opslaat in Supabase. Inclusief market discovery voor 20 Europese hoofdsteden.

## Waarom

Om te kunnen analyseren hoe odds op weather markets over tijd verschuiven. Bestaande `sync-prices` endpoint slaat alleen top-of-book (best bid/ask) op. Dit systeem slaat alle bid/ask levels op als JSONB, zodat je volledige orderbook diepte kunt terugzien.

## Belangrijke beslissingen

| Beslissing | Rationale |
|-----------|-----------|
| Twee aparte webhooks (discovery 30min + snapshot 1min) | Discovery is zwaar (veel Gamma API calls), snapshot moet snel zijn |
| Full orderbook als JSONB + pre-computed summary columns | Weather orderbooks zijn dun (~20 levels), JSONB is compact. Summary columns voor snelle time-series queries |
| Aparte `discovery.py` module (niet in gamma.py) | EU city search is een ander concern dan de basis Gamma client |
| City classifier in Python (niet in SQL) | Flexibeler, makkelijker te testen, draait bij discovery |

## Bestanden aangemaakt

| Bestand | Doel |
|---------|------|
| `supabase/migrations/006_orderbook_snapshots.sql` | Nieuwe tabel + city/region kolommen op markets |
| `services/api/src/data/market/discovery.py` | EU/US city search + city classifier |
| `services/api/tests/test_discovery.py` | 5 tests voor city classifier |
| `services/api/tests/test_orderbook.py` | 2 tests voor orderbook fetching |

## Bestanden gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `services/api/src/data/market/clob.py` | `get_orderbook()` en `get_orderbooks_batch()` toegevoegd |
| `services/api/src/models/market.py` | `OrderbookLevel`, `OrderbookSnapshotResponse`, `OddsTimepoint` models |
| `services/api/src/api/webhooks.py` | Twee nieuwe endpoints: `discover-weather-markets`, `snapshot-orderbooks` |
| `services/api/src/api/markets.py` | Drie nieuwe endpoints: `/weather`, `/{id}/orderbook`, `/{id}/orderbook/history` |
| `CLAUDE.md` | Orderbook tracking sectie, project structure update |
| `.claude/skills/trader-data.md` | `orderbook_snapshots` tabel in schema overview |
| `.claude/skills/polymarket-api.md` | Orderbook fetching + discovery docs |
| `.claude/skills/trader-backend.md` | `discovery.py` in architecture tree |

## Externe services geconfigureerd

### Supabase
- Migration 006 is al toegepast op project `wfjwyragybeadbbcwwuz` (PolyTrader)
- Nieuwe tabel: `orderbook_snapshots` met RLS policies
- Nieuwe kolommen op `markets`: `city TEXT`, `region TEXT` met indexes

### n8n workflows — NOG NIET AANGEMAAKT
De n8n SDK syntax was niet beschikbaar tijdens de sessie. De twee workflows moeten handmatig in de n8n UI worden aangemaakt:

1. **Poly - Discover Weather Markets** (elke 30 min)
   - Schedule Trigger: every 30 minutes
   - HTTP Request: `POST https://polytraderabe.vercel.app/api/webhook/discover-weather-markets`
   - Header: `x-webhook-secret: poly-webhook-3c2ea740f312c0d9e2e8c1f6c34c34f4`
   - Timeout: 60s

2. **Poly - Snapshot Orderbooks** (elke 1 min)
   - Schedule Trigger: every 1 minute
   - HTTP Request: `POST https://polytraderabe.vercel.app/api/webhook/snapshot-orderbooks`
   - Header: `x-webhook-secret: poly-webhook-3c2ea740f312c0d9e2e8c1f6c34c34f4`
   - Timeout: 55s

## Environment variables

Geen nieuwe env vars nodig. Gebruikt bestaande `WEBHOOK_SECRET`, Supabase credentials, en Polymarket CLOB/Gamma URLs.

## Europese hoofdsteden (20)

Amsterdam, London, Paris, Berlin, Madrid, Rome, Lisbon, Brussels, Vienna, Zurich, Stockholm, Copenhagen, Oslo, Helsinki, Warsaw, Prague, Budapest, Athens, Dublin, Bucharest

## Data volume schatting

| Metric | Waarde |
|--------|--------|
| Weather markets (schatting) | 10-30 actief |
| Tokens per market | 2 (YES + NO) |
| Snapshots per minuut | 20-60 rijen |
| Rijen per dag | ~29K-86K |
| Opslag per dag | ~60-400 MB |
| 30 dagen totaal | ~2-12 GB |

## Bekende issues / follow-up

1. **n8n workflows moeten nog worden aangemaakt** in de UI (zie boven)
2. **Europese weather markets bestaan mogelijk niet** op Polymarket (US-focused platform). Discovery draait, maar kan 0 EU markets vinden
3. **Data retention policy ontbreekt** — na 7 dagen zou je 5-min samples moeten houden, na 30 dagen hourly. Implementeer als `pg_cron` job
4. **Merge conflict opgelost** met de andere worktree die `sync-weather` endpoint en weather forecasts tabel had toegevoegd — beide endpoints zijn behouden
5. **Eerste discovery nog niet gedraaid** — run handmatig of wacht op n8n workflow

## Verificatie

```bash
# Tests draaien (vanuit services/api/)
python -m pytest tests/test_discovery.py tests/test_orderbook.py -v

# Discovery handmatig testen
curl -X POST https://polytraderabe.vercel.app/api/webhook/discover-weather-markets \
  -H "x-webhook-secret: poly-webhook-3c2ea740f312c0d9e2e8c1f6c34c34f4"

# Orderbook snapshot testen (na discovery)
curl -X POST https://polytraderabe.vercel.app/api/webhook/snapshot-orderbooks \
  -H "x-webhook-secret: poly-webhook-3c2ea740f312c0d9e2e8c1f6c34c34f4"

# Weather markets opvragen
curl https://polytraderabe.vercel.app/api/markets/weather?region=europe
```
