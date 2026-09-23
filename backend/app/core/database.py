"""Database access and repository provisioning.

Chooses the active storage backend:
  - AstraRepository when Astra DB credentials are configured;
  - MemoryRepository otherwise (offline dev and tests).
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.repositories.base import Repository
from app.repositories.memory import MemoryRepository


@lru_cache
def get_repository() -> Repository:
    settings = get_settings()
    if settings.astra_configured:
        try:
            from app.repositories.astra import AstraRepository

            return AstraRepository()
        except Exception:  # pragma: no cover - falls back on connection failure
            # Never fail startup on Astra connection issues; degrade safely.
            return MemoryRepository()
    return MemoryRepository()
