"""Security primitives: Argon2id password hashing and JWT handling.

Passwords are hashed with Argon2id (via argon2-cffi) and are NEVER stored or
returned in plaintext. Access tokens are short-lived JWTs; refresh tokens have
a longer lifetime and are revocable (stored server-side).
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings

# Argon2id with conservative-but-modern parameters. These parallel OWASP
# recommendations for interactive logins.
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MiB
    parallelism=4,
    hash_len=32,
)

_access_tokens: set[str] = set()
_refresh_tokens: set[str] = set()


# ---------------------------------------------------------------------------
# Password hashing (Argon2id)
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Return an Argon2id PHC-encoded hash of the password."""
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against an Argon2id hash.

    Returns False (never raises) on mismatch or on malformed stored hash so
    callers can produce uniform, safe error responses.
    """
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError, ValueError):
        return False


def needs_rehash(hashed: str) -> bool:
    """True if the stored hash uses parameters older than the current ones."""
    try:
        return _hasher.check_needs_rehash(hashed)
    except (InvalidHashError, ValueError):
        return False


# ---------------------------------------------------------------------------
# JWT creation / decoding
# ---------------------------------------------------------------------------
def _create_token(
    subject: str, token_type: str, expires_seconds: int, secret: str
) -> tuple[str, str, int]:
    token_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=expires_seconds)
    payload = {
        "sub": subject,
        "type": token_type,
        "jti": token_id,
        "iat": now,
        "exp": expires,
    }
    token = jwt.encode(payload, secret, algorithm=get_settings().jwt_algorithm)
    return token, token_id, int(expires.timestamp())


def create_access_token(user_id: str) -> tuple[str, str, int]:
    """Create a short-lived access token; returns (token, jti, expires_ts)."""
    s = get_settings()
    token, jti, exp = _create_token(
        user_id, "access", s.jwt_access_token_expire_seconds, s.jwt_access_secret
    )
    _access_tokens.add(jti)
    return token, jti, exp


def create_refresh_token(user_id: str) -> tuple[str, str, int]:
    """Create a long-lived refresh token; returns (token, jti, expires_ts)."""
    s = get_settings()
    token, jti, exp = _create_token(
        user_id, "refresh", s.jwt_refresh_token_expire_seconds, s.jwt_refresh_secret
    )
    _refresh_tokens.add(jti)
    return token, jti, exp


def revoke_access_token(jti: Optional[str]) -> None:
    if jti:
        _access_tokens.discard(jti)


def revoke_refresh_token(jti: Optional[str]) -> None:
    if jti:
        _refresh_tokens.discard(jti)


def _decode(token: str, secret: str) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(
            token, secret, algorithms=[get_settings().jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None


def validate_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode + verify an access token is still valid (not revoked/expired)."""
    s = get_settings()
    payload = _decode(token, s.jwt_access_secret)
    if not payload or payload.get("type") != "access":
        return None
    if payload.get("jti") not in _access_tokens:
        return None
    return payload


def validate_refresh_token(token: str) -> Optional[dict[str, Any]]:
    """Decode + verify a refresh token is valid and not revoked."""
    s = get_settings()
    payload = _decode(token, s.jwt_refresh_secret)
    if not payload or payload.get("type") != "refresh":
        return None
    if payload.get("jti") not in _refresh_tokens:
        return None
    return payload
