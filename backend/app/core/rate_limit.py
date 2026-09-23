"""Rate-limiting configuration built on slowapi.

Limits are read from environment variables (requests per minute) so they can be
tuned without code changes. Stricter limits are applied to sensitive endpoints
such as login, registration, refresh, comments and post creation.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_ip(request) -> str:
    """Identify the real client IP, honouring reverse-proxy headers.

    Render (and most PaaS) terminate TLS at a proxy: without this, every user
    would share the proxy's IP and collide into one rate-limit bucket, breaking
    login/register for everyone. X-Forwarded-For is client,proxy1,proxy2 —
    the first entry is the original client.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# slowapi's own RATELIMIT_ENABLED env var controls enforcement
# (tests set it to "false"). Constructing lazily keeps imports clean.
limiter = Limiter(key_func=_client_ip)


def login_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_login_per_min}/minute"


def register_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_register_per_min}/minute"


def refresh_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_refresh_per_min}/minute"


def comment_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_comment_per_min}/minute"


def create_post_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_create_post_per_min}/minute"


def reply_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_reply_per_min}/minute"


def ai_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_ai_per_min}/minute"


def ai_limit_for_user(is_premium: bool) -> str:
    from app.core.config import get_settings

    s = get_settings()
    rpm = s.ai_premium_rate_limit if is_premium else s.ai_free_rate_limit
    return f"{rpm}/minute"


def default_limit() -> str:
    from app.core.config import get_settings

    return f"{get_settings().rate_limit_default_per_min}/minute"
