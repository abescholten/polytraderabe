# Handover: Deployment Fix & Open Items Plan

**Datum**: 2026-04-03
**Sessie**: Vercel deployment fix + inventarisatie openstaande items

## Wat is gefixt

### Vercel Build Failure (CRITICAL)
Alle Vercel deployments faalden sinds commit `47f29e0` (Remove experimentalServices). De site was volledig down.

**Root cause**: `vercel.json` had `"framework": "nextjs"` maar de root `package.json` bevat alleen `turbo`. Next.js zit in `apps/web/package.json`. Eerder werkte dit omdat `experimentalServices` Vercel vertelde dat Next.js in `apps/web` zat. Toen dat verwijderd werd (vanwege Python import errors), brak de framework detection.

**Fix**: `"framework": "nextjs"` verwijderd uit `vercel.json`. Vercel draait nu de custom `buildCommand` (`cd apps/web && pnpm build`) zonder framework-specifieke version check. Beide runtimes (Python + Node.js) worden correct gedetecteerd.

### Migration Numbering Conflict
Twee bestanden hadden hetzelfde prefix `006_`:
- `006_weather_forecasts.sql` (van main branch)
- `006_orderbook_snapshots.sql` (van worktree-marketdata branch)

**Fix**: `006_orderbook_snapshots.sql` hernoemd naar `007_orderbook_snapshots.sql`. Beide migrations waren al toegepast op Supabase, dus dit is alleen voor consistentie.

### Lokale main gesynchroniseerd
Lokale main stond achter op remote (PR #1 en #2 merges ontbraken). `git pull` uitgevoerd.

## Belangrijke beslissingen

| Beslissing | Rationale |
|-----------|-----------|
| Framework key verwijderen ipv experimentalServices terugzetten | experimentalServices was eerder verwijderd vanwege Python import errors — niet opnieuw introduceren |
| Geen rootDirectory instellen op apps/web | Dat zou de Python API rewrites breken (`/api/*` → `api/main.py`) |

## Bestanden gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `vercel.json` | `"framework": "nextjs"` verwijderd |
| `supabase/migrations/006_orderbook_snapshots.sql` | Hernoemd naar `007_orderbook_snapshots.sql` |

## Verificatie

- Vercel deployment `dpl_4nP5pkCbP8Btk8qRpjBeEwUhw7Lj`: **READY**
- Production URL: `polytraderabe.vercel.app` — live
- Runtimes: Python + Node.js beide gedetecteerd
- Build tijd: ~48 seconden
- Lokale `pnpm build` in `apps/web`: slaagt (10 pagina's)

## Openstaande items (niet gestart)

### Hoge prioriteit

1. **n8n workflow: Poly - Discover Weather Markets**
   - Schedule: elke 30 minuten
   - POST `https://polytraderabe.vercel.app/api/webhook/discover-weather-markets`
   - Header: `x-webhook-secret: poly-webhook-3c2ea740f312c0d9e2e8c1f6c34c34f4`
   - Timeout: 60s
   - Moet handmatig in n8n UI of via SDK aangemaakt worden

2. **n8n workflow: Poly - Snapshot Orderbooks**
   - Schedule: elke 1 minuut
   - POST `https://polytraderabe.vercel.app/api/webhook/snapshot-orderbooks`
   - Header: `x-webhook-secret: poly-webhook-3c2ea740f312c0d9e2e8c1f6c34c34f4`
   - Timeout: 55s
   - Moet handmatig in n8n UI of via SDK aangemaakt worden

### Medium prioriteit

3. **Weather strategy cache optimalisatie**
   - Bestand: `services/api/src/trading/strategies/weather_temp.py`
   - Probleem: `generate_signal()` haalt elke keer live data op van Open-Meteo, terwijl `sync-weather` al elke uur forecasts cached in Supabase `weather_forecasts` tabel
   - Fix: eerst Supabase cache checken (< 2 uur oud), dan fallback naar live Open-Meteo
   - Reduceert API calls met ~75%

4. **Data retention policy**
   - `orderbook_snapshots` tabel groeit ~30K-86K rijen/dag (~60-400 MB/dag)
   - Na 7 dagen: downsample naar 5-minuut intervallen
   - Na 30 dagen: downsample naar hourly
   - Implementatie: webhook endpoint `/api/webhook/cleanup-old-data` + n8n workflow (dagelijks)
   - Of: Supabase pg_cron job

### Lage prioriteit

5. **Dashboard auth** — iedereen met URL kan erbij. Geen gevoelige data, maar niet ideaal
6. **Backtest verbetering** — gebruikt gesimuleerde data ipv echte historische forecasts
7. **Europese weather markets** — discovery moet nog draaien om te bevestigen of ze bestaan op Polymarket

## Bestaande n8n workflows (alle actief)

| Workflow | ID | Schedule | Status |
|----------|-----|----------|--------|
| Poly - Weather Signal Scanner | hCV7d0KT70ZueMtF | Elke 5 min | Actief |
| Poly - Price Sync | PqOhtUUrGWX1EW6N | Elke 15 min | Actief |
| Poly - Resolution Checker | XFNvWsZ2aPPK0tCV | Elk uur | Actief |
| Poly - Daily Report | tcWOFr2Bn5zIW4t4 | Dagelijks 09:00 UTC | Actief |
| Poly - Weather Sync | VZVEkgXieMPvVEc0 | Elk uur | Actief |
| Poly - Discover Weather Markets | — | Elke 30 min | **NOG AANMAKEN** |
| Poly - Snapshot Orderbooks | — | Elke 1 min | **NOG AANMAKEN** |
