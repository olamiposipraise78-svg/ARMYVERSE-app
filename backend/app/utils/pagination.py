"""Query-parameter parsing and pagination helpers."""

from app.core.config import get_settings


def clamp_offset(offset: int) -> int:
    return max(0, offset)


def resolve_page_size(page_size: int | None) -> int:
    settings = get_settings()
    if page_size is None:
        return settings.page_size_default
    return min(max(1, page_size), settings.page_size_max)


def has_more(total: int, offset: int, limit: int) -> bool:
    return offset + limit < total
