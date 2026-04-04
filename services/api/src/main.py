from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.signals import router as signals_router
from src.api.strategies import router as strategies_router
from src.api.portfolio import router as portfolio_router
from src.api.markets import router as markets_router
from src.api.health import router as health_router
from src.api.webhooks import router as webhooks_router
from src.api.weather_api import router as weather_router
from src.api.weather_actuals_api import router as weather_actuals_router

app = FastAPI(
    title="PolyTrader API",
    description="Prediction market weather trading platform",
    version="0.1.0",
)

# CORS middleware — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(signals_router, prefix="/signals", tags=["Signals"])
app.include_router(strategies_router, prefix="/strategies", tags=["Strategies"])
app.include_router(portfolio_router, prefix="/portfolio", tags=["Portfolio"])
app.include_router(markets_router, prefix="/markets", tags=["Markets"])
app.include_router(health_router, prefix="/health", tags=["Health"])
app.include_router(webhooks_router, prefix="/webhook", tags=["Webhooks"])
app.include_router(weather_router, prefix="/weather", tags=["Weather"])
app.include_router(weather_actuals_router, prefix="/weather", tags=["Weather"])


@app.get("/")
async def root():
    return {
        "name": "PolyTrader API",
        "version": "0.1.0",
        "docs": "/docs",
    }
