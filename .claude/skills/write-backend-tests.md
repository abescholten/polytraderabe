---
name: write-backend-tests
description: >
  Write Python unit tests for backend code (services/api). Trigger on: "write tests",
  "add tests", "unit test", "test coverage", "pytest", "test this function", "test the
  backend", "needs tests", or when new Python code has been written that lacks tests.
  Proactively trigger after implementing new backend functionality.
---

# Write Backend Tests

You are a Python test writer for the PolyTrader backend. You write pytest tests that follow
the existing patterns in `services/api/tests/`.

## Existing Patterns (follow these)

The project uses:
- **pytest** + **pytest-asyncio** for async tests
- **unittest.mock** (AsyncMock, MagicMock, patch) for mocking external APIs
- Tests live in `services/api/tests/test_<module>.py`
- Imports reference `src.<module>` paths

### Sync test example (from test_discovery.py):

```python
from src.data.market.discovery import classify_market_city, EUROPEAN_CAPITALS

def test_classify_amsterdam():
    result = classify_market_city("Will Amsterdam temperature exceed 25°C on July 15?")
    assert result is not None
    assert result["city"] == "Amsterdam"
    assert result["region"] == "europe"
```

### Async test example (from test_orderbook.py):

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_get_orderbook_returns_bids_and_asks():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"bids": [...], "asks": [...]}

    with patch("src.data.market.clob.httpx.AsyncClient") as mock_client:
        instance = AsyncMock()
        instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__ = AsyncMock(return_value=instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await get_orderbook("token123")

    assert result is not None
```

## Test Writing Rules

### 1. Determine What to Test

Read the source file and identify:
- **Pure functions** (no I/O) — test directly with real inputs
- **Async functions with HTTP calls** — mock httpx/supabase, test logic
- **API endpoints** — test via FastAPI TestClient if available
- **Data transformations** — test with known input/output pairs

### 2. What Every Test File Needs

```python
# services/api/tests/test_<module>.py

import pytest
from unittest.mock import AsyncMock, MagicMock, patch  # only if mocking needed

from src.<module_path> import <functions_to_test>

# Happy path — the normal case works
def test_<function>_happy_path():
    result = <function>(valid_input)
    assert result == expected_output

# Edge case — boundary values, empty inputs
def test_<function>_empty_input():
    result = <function>([])
    assert result == expected_empty

# Error case — what happens when things fail
def test_<function>_handles_error():
    result = <function>(bad_input)
    assert result is None  # or raises expected exception
```

### 3. Priority Modules to Test

Based on the current codebase, these modules need tests most:

| Module | File | Testable Functions | Mocking Needed |
|--------|------|--------------------|----------------|
| Weather probability | `src/data/weather/probability.py` | `threshold_probability`, `celsius_to_fahrenheit`, `fahrenheit_to_celsius` | No (pure math) |
| CLOB client | `src/data/market/clob.py` | `get_price`, `get_orderbook` | Yes (httpx) |
| Gamma client | `src/data/market/gamma.py` | Market search/discovery functions | Yes (httpx) |
| Discovery | `src/data/market/discovery.py` | `classify_market_city` | No (pure logic) |
| Open-Meteo | `src/data/weather/open_meteo.py` | Forecast fetching | Yes (httpx) |
| Risk manager | `src/trading/risk/` | Limit checks, position sizing | No (pure logic) |
| Strategies | `src/trading/strategies/` | Signal generation | Partial |

### 4. Mocking Guidelines

**Mock external services, never call them:**
- `httpx.AsyncClient` — mock for any Polymarket/Open-Meteo API call
- `supabase.Client` — mock for any database operation
- Never mock Python stdlib or pure functions

**Mocking httpx pattern:**
```python
with patch("src.<module>.httpx.AsyncClient") as mock_client:
    instance = AsyncMock()
    instance.get = AsyncMock(return_value=mock_response)
    mock_client.return_value.__aenter__ = AsyncMock(return_value=instance)
    mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
```

**Mocking Supabase pattern:**
```python
with patch("src.<module>.get_supabase") as mock_sb:
    mock_table = MagicMock()
    mock_table.select.return_value.execute.return_value = MagicMock(data=[...])
    mock_sb.return_value.table.return_value = mock_table
```

### 5. Test Naming Convention

```
test_<function_name>_<scenario>
```

Examples:
- `test_threshold_probability_above_50_percent`
- `test_get_price_returns_none_on_timeout`
- `test_classify_market_city_unknown_returns_none`

### 6. Running Tests

After writing tests, always run them:

```bash
cd services/api && pytest tests/ -v
```

If a specific test file:
```bash
cd services/api && pytest tests/test_probability.py -v
```

**Tests MUST pass before considering the task done.**

## Step-by-Step Process

1. **Read the source** — understand what the function does, its inputs/outputs
2. **Identify test cases** — happy path, edge cases, error cases
3. **Write the test file** — follow the naming and structure above
4. **Run the tests** — `pytest tests/ -v`
5. **Fix failures** — iterate until all tests pass
6. **Report coverage** — list which functions are now tested
