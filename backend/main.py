"""
NetWatch Backend — FastAPI application entrypoint.

Initialises the database, loads ML models, mounts routers, and starts the
asynchronous event loop that powers the detection pipeline and WebSocket
alert streaming.
"""

import time
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from config import settings
from database import init_db
from detection.stage2_ml import MLClassifier
from metrics import ML_LOADED
from routers import ingest, alerts, ws, threats, session

logger = logging.getLogger("netwatch")

# ── Global state shared across the app ────────────────────────────────────
ml_classifier = MLClassifier(settings.ML_MODELS_PATH)
start_time: float = 0.0
flows_processed: int = 0


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle manager."""
    global start_time

    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    logger.info("Initialising database …")
    await init_db()

    logger.info("Loading ML models from %s …", settings.ML_MODELS_PATH)
    ml_classifier.load()
    ML_LOADED.set(1 if ml_classifier.is_loaded else 0)

    start_time = time.time()
    logger.info("NetWatch backend ready.")

    yield

    logger.info("Shutting down NetWatch backend.")


app = FastAPI(
    title="NetWatch — Network Anomaly Detection & IDS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount routers ─────────────────────────────────────────────────────────
app.include_router(ingest.router)
app.include_router(alerts.router)
app.include_router(ws.router)
app.include_router(threats.router)
app.include_router(session.router)


@app.get("/health")
async def health() -> dict:
    """Health check endpoint used by Docker and the dashboard."""
    return {
        "status": "ok",
        "ml_loaded": ml_classifier.is_loaded,
        "flows_processed": flows_processed,
        "uptime_seconds": round(time.time() - start_time, 2),
    }


@app.get("/metrics")
async def prometheus_metrics() -> PlainTextResponse:
    """Prometheus scrape endpoint."""
    return PlainTextResponse(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
