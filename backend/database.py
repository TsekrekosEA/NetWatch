"""
NetWatch Backend — SQLite database initialisation and access.

Uses aiosqlite for fully async I/O with WAL mode enabled for concurrent
reads during alert streaming.
"""

import aiosqlite
import logging

from config import settings

logger = logging.getLogger("netwatch.database")

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS alerts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     REAL    NOT NULL,
    src_ip        TEXT    NOT NULL,
    dst_ip        TEXT    NOT NULL,
    src_port      INTEGER,
    dst_port      INTEGER,
    protocol      TEXT,
    category      TEXT    NOT NULL,
    severity      TEXT    NOT NULL,
    stage         TEXT    NOT NULL,
    details       TEXT,
    flow_duration REAL,
    total_bytes   INTEGER,
    total_packets INTEGER
);

CREATE TABLE IF NOT EXISTS flow_stats (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     REAL    NOT NULL,
    protocol      TEXT    NOT NULL,
    total_flows   INTEGER DEFAULT 0,
    total_bytes   INTEGER DEFAULT 0,
    total_packets INTEGER DEFAULT 0,
    alert_count   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_flow_stats_ts    ON flow_stats(timestamp DESC);
"""


async def init_db() -> None:
    """Create tables and indices if they do not exist."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.executescript(_SCHEMA_SQL)
        await db.commit()
    logger.info("Database initialised at %s", settings.DB_PATH)


async def get_db() -> aiosqlite.Connection:
    """Return an async database connection. Caller must close it."""
    db = await aiosqlite.connect(settings.DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL;")
    return db
