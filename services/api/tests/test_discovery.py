from src.data.market.discovery import classify_market_city, EUROPEAN_CAPITALS


def test_classify_amsterdam():
    result = classify_market_city("Will Amsterdam temperature exceed 25°C on July 15?")
    assert result is not None
    assert result["city"] == "Amsterdam"
    assert result["region"] == "europe"


def test_classify_london():
    result = classify_market_city("Will London see rain on April 10?")
    assert result is not None
    assert result["city"] == "London"
    assert result["region"] == "europe"


def test_classify_nyc():
    result = classify_market_city("Will NYC temperature exceed 80°F on April 15?")
    assert result is not None
    assert result["city"] == "New York"
    assert result["region"] == "north_america"


def test_classify_unknown_city():
    result = classify_market_city("Will it rain tomorrow?")
    assert result is None


def test_european_capitals_has_key_cities():
    assert "amsterdam" in EUROPEAN_CAPITALS
    assert "london" in EUROPEAN_CAPITALS
    assert "paris" in EUROPEAN_CAPITALS
    assert "berlin" in EUROPEAN_CAPITALS
    assert "madrid" in EUROPEAN_CAPITALS
    assert "rome" in EUROPEAN_CAPITALS
