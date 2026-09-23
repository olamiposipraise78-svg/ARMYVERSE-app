"""Reusable FastAPI dependencies.

Provides the active repository and the authenticated-current-user dependency.
Identity is ALWAYS derived from the validated access token, never trusted from
client-supplied user IDs.
"""

from __future__ import annotations

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import get_repository
from app.core.errors import AuthenticationError
from app.core.security import validate_access_token
from app.models import User
from app.repositories.base import Repository

_bearer = HTTPBearer(auto_error=False)


def get_db() -> Repository:
    return get_repository()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    repo: Repository = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Authentication required.")
    payload = validate_access_token(credentials.credentials)
    if not payload:
        raise AuthenticationError("Invalid or expired access token.")
    user = repo.get_user_by_id(payload.get("sub") or "")
    if not user:
        raise AuthenticationError("Account no longer exists.")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    repo: Repository = Depends(get_db),
) -> User | None:
    """Resolve the current user if a valid token is present, else None.

    Used by public-ish endpoints (e.g. GET /api/posts) to augment responses
    with the viewer's like/save state without requiring authentication.
    """
    if credentials is None or not credentials.credentials:
        return None
    payload = validate_access_token(credentials.credentials)
    if not payload:
        return None
    return repo.get_user_by_id(payload.get("sub") or "")
