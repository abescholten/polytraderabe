import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.data.market.clob import get_orderbook


@pytest.mark.asyncio
async def test_get_orderbook_returns_bids_and_asks():
    book_data = {
        "bids": [
            {"price": "0.65", "size": "100"},
            {"price": "0.64", "size": "200"},
        ],
        "asks": [
            {"price": "0.67", "size": "150"},
            {"price": "0.68", "size": "300"},
        ],
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = book_data

    with patch("src.data.market.clob.httpx.AsyncClient") as mock_client:
        instance = AsyncMock()
        instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__ = AsyncMock(return_value=instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await get_orderbook("token123")

    assert result is not None
    assert len(result["bids"]) == 2
    assert len(result["asks"]) == 2
    assert result["bids"][0]["price"] == "0.65"


@pytest.mark.asyncio
async def test_get_orderbook_returns_none_on_error():
    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch("src.data.market.clob.httpx.AsyncClient") as mock_client:
        instance = AsyncMock()
        instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__ = AsyncMock(return_value=instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await get_orderbook("bad_token")

    assert result is None
