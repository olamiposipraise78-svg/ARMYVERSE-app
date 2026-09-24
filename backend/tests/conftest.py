"""Shared pytest fixtures.

Each test runs against a fresh in-memory repository so tests are isolated.
The repository factory and settings are cache-cleared between tests.
"""

import os

os.environ["RATE_LIMIT_ENABLED"] = "false"
# slowapi reads its own env var; disable it for tests
os.environ["RATELIMIT_ENABLED"] = "false"
# Disable MemoryRepository file persistence so tests stay isolated in memory.
os.environ["ARMYVERSE_DATA_FILE"] = ""
# Force the in-memory repository for tests regardless of local .env values,
# so the suite never connects to or writes to a real Astra DB.
os.environ["ASTRA_DB_API_ENDPOINT"] = ""
os.environ["ASTRA_DB_APPLICATION_TOKEN"] = ""

import pytest
from fastapi.testclient import TestClient

from app.core import database
from app.core.config import get_settings


@pytest.fixture()
def client():
    """A TestClient with a fresh in-memory repository and clean token store."""
    # Force a fresh repository instance per test.
    database.get_repository.cache_clear()
    from app.main import app

    with TestClient(app) as c:
        yield c


def _valid_username(label: str) -> str:
    """Ensure usernames meet the backend's minimum length (3 chars)."""
    label = label.strip()
    if len(label) < 3:
        return f"u{label}"
    return label


@pytest.fixture()
def auth_headers(client):
    """Register a user and return (Authorization header, user dict)."""

    def _register(username, password="password123", email=None):
        username = _valid_username(username)
        payload = {
            "username": username,
            "email": email or f"{username}@example.com",
            "password": password,
            "display_name": f"Display {username}",
        }
        r = client.post("/api/auth/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        return {
            "auth": {"Authorization": f"Bearer {data['access_token']}"},
            "user": data["user"],
        }

    return _register


@pytest.fixture()
def make_user(client):
    """Register a user and return the user public dict."""

    def _make(username, password="password123", email=None):
        username = _valid_username(username)
        payload = {
            "username": username,
            "email": email or f"{username}@example.com",
            "password": password,
            "display_name": f"Display {username}",
        }
        r = client.post("/api/auth/register", json=payload)
        assert r.status_code == 200, r.text
        return r.json()["user"]

    return _make
