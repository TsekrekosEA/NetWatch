"""
NetWatch Backend — Threat intelligence REST router.

Provides per-IP enrichment (GeoIP + optional AbuseIPDB).
"""

import logging
from fastapi import APIRouter

from enrichment import enrich_ip

logger = logging.getLogger("netwatch.threats")

router = APIRouter()


@router.get("/threats/intel/{ip}")
async def ip_intel(ip: str) -> dict:
    """
    Return GeoIP and threat intelligence for the given IP address.

    Private/RFC-1918 addresses return `{"private": true}`.
    AbuseIPDB fields are only present when ABUSEIPDB_API_KEY is configured.
    """
    return await enrich_ip(ip)
