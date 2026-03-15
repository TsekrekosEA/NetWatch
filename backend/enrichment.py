"""
NetWatch Backend — IP threat intelligence enrichment.

Provides GeoIP lookup (via ip-api.com, no API key required) and
optional AbuseIPDB confidence scoring (set ABUSEIPDB_API_KEY env var).

Results are cached in-memory for 1 hour to avoid hammering rate limits.
Private / RFC-1918 addresses are skipped (they never enrich usefully).

Usage:
    from enrichment import enrich_ip
    intel = await enrich_ip("185.220.101.45")
    # -> {"country": "DE", "city": "...", "isp": "...", "abuse_score": 87, ...}
"""

import asyncio
import ipaddress
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger("netwatch.enrichment")

# ── In-memory cache: ip → (timestamp, result) ────────────────────────────
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 3600  # 1 hour
_MAX_CACHE = 10_000


def _is_private(ip: str) -> bool:
    """Return True for loopback / private / link-local addresses."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return True


def _cache_get(ip: str) -> Optional[dict]:
    entry = _CACHE.get(ip)
    if entry and time.time() - entry[0] < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(ip: str, data: dict) -> None:
    if len(_CACHE) >= _MAX_CACHE:
        # Evict oldest 10%
        oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:_MAX_CACHE // 10]
        for k, _ in oldest:
            del _CACHE[k]
    _CACHE[ip] = (time.time(), data)


async def _geoip(ip: str, client: httpx.AsyncClient) -> dict:
    """Fetch GeoIP data from ip-api.com (free, 45 req/min)."""
    fields = "status,country,countryCode,regionName,city,isp,org,as,query"
    try:
        resp = await client.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": fields},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                return {
                    "country": data.get("country", ""),
                    "country_code": data.get("countryCode", ""),
                    "region": data.get("regionName", ""),
                    "city": data.get("city", ""),
                    "isp": data.get("isp", ""),
                    "org": data.get("org", ""),
                    "asn": data.get("as", ""),
                }
    except Exception as exc:
        logger.debug("GeoIP lookup failed for %s: %s", ip, exc)
    return {}


async def _abuseipdb(ip: str, client: httpx.AsyncClient, api_key: str) -> dict:
    """Fetch AbuseIPDB confidence score (requires API key)."""
    try:
        resp = await client.get(
            "https://api.abuseipdb.com/api/v2/check",
            params={"ipAddress": ip, "maxAgeInDays": 90},
            headers={"Key": api_key, "Accept": "application/json"},
            timeout=8,
        )
        if resp.status_code == 200:
            d = resp.json().get("data", {})
            return {
                "abuse_score": d.get("abuseConfidenceScore", 0),
                "abuse_reports": d.get("totalReports", 0),
                "abuse_last_reported": d.get("lastReportedAt", None),
                "abuse_num_distinct_users": d.get("numDistinctUsers", 0),
                "is_tor": d.get("isTor", False),
            }
    except Exception as exc:
        logger.debug("AbuseIPDB lookup failed for %s: %s", ip, exc)
    return {}


async def enrich_ip(ip: str) -> dict:
    """
    Return threat intelligence for an IP address.

    Always includes GeoIP fields; adds AbuseIPDB fields when
    ABUSEIPDB_API_KEY is set. Private IPs return an empty dict.
    """
    if _is_private(ip):
        return {"private": True}

    cached = _cache_get(ip)
    if cached is not None:
        return cached

    api_key = os.environ.get("ABUSEIPDB_API_KEY", "")

    async with httpx.AsyncClient() as client:
        tasks = [_geoip(ip, client)]
        if api_key:
            tasks.append(_abuseipdb(ip, client, api_key))
        results = await asyncio.gather(*tasks, return_exceptions=True)

    intel: dict = {"ip": ip}
    for r in results:
        if isinstance(r, dict):
            intel.update(r)

    _cache_set(ip, intel)
    return intel
