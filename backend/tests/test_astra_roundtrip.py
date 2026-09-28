"""Astra document round-trip tests.

The Data API is JSON-only, so `AstraRepository._doc` writes datetimes out as ISO
strings and `_from_doc` has to turn them back into real datetimes. The rest of
the suite runs against `MemoryRepository`, which keeps genuine datetime objects
and therefore never exercises this seam. These tests cover it directly, without
connecting to Astra: `_doc`/`_from_doc`/`_parse_dt` are static methods, so the
class can be used without constructing a client.
"""

from datetime import datetime, timedelta, timezone

from app.models import Notification, Post, Story, User
from app.models.entity import now_utc
from app.repositories.astra import AstraRepository
from app.serializers.frontend import (
    iso_fmt,
    notification_to_frontend,
    post_to_frontend,
    story_to_frontend,
    user_to_frontend,
)


def _round_trip(model, model_cls):
    """Write a model to a document and read it back the way Astra would."""
    doc = {"_id": model.id, **AstraRepository._doc(model)}
    return AstraRepository._from_doc(model_cls, doc)


def test_doc_writes_datetimes_as_iso_strings():
    user = User(username="astrawriter", email="astrawriter@example.com")
    doc = AstraRepository._doc(user)
    assert isinstance(doc["created_at"], str)
    assert datetime.fromisoformat(doc["created_at"])


def test_from_doc_restores_datetime_fields():
    user = User(username="astrawriter", email="astrawriter@example.com")
    restored = _round_trip(user, User)
    assert isinstance(restored.created_at, datetime)
    assert restored.created_at == user.created_at
    assert isinstance(restored.updated_at, datetime)


def test_from_doc_stamps_naive_timestamps_as_utc():
    """Legacy rows may hold a naive ISO string; comparisons need it tz-aware."""
    doc = {
        "_id": "abc",
        "username": "legacy",
        "email": "legacy@example.com",
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00",
    }
    user = AstraRepository._from_doc(User, doc)
    assert user.created_at.tzinfo is not None
    # Comparable against now_utc() without raising TypeError.
    assert user.created_at < now_utc()


def test_from_doc_keeps_id_and_drops_document_key():
    """Documents carry both `_id` and `id`; the model takes `id`.

    `_from_doc` must pop `_id`, otherwise it reaches the dataclass as an
    unexpected keyword argument and raises TypeError.
    """
    user = User(username="keyed", email="keyed@example.com")
    doc = {"_id": user.id, **AstraRepository._doc(user)}
    restored = AstraRepository._from_doc(User, doc)
    assert restored.id == user.id


def test_from_doc_ignores_unparseable_timestamp():
    doc = {"_id": "abc", "created_at": "not-a-date"}
    user = AstraRepository._from_doc(User, doc)
    # Falls back to the dataclass default rather than raising.
    assert isinstance(user.created_at, datetime)


def test_parse_dt_passes_through_datetimes_and_rejects_junk():
    now = now_utc()
    assert AstraRepository._parse_dt(now) is now
    assert AstraRepository._parse_dt(None) is None
    assert AstraRepository._parse_dt(12345) is None
    assert AstraRepository._parse_dt("nope") is None


def test_user_from_astra_serializes_created_at():
    """Regression: login/serialize raised AttributeError on a str timestamp."""
    user = User(username="astralogin", email="astralogin@example.com")
    restored = _round_trip(user, User)
    payload = user_to_frontend(restored)
    assert payload["createdAt"] == user.created_at.isoformat()


def test_post_from_astra_serializes_created_at():
    post = Post(author_id="a1", caption="hello")
    payload = post_to_frontend(_round_trip(post, Post))
    assert payload["createdAt"] == post.created_at.isoformat()


def test_notification_from_astra_serializes_created_at():
    notification = Notification(user_id="u1", actor_id="u2", type="like")
    payload = notification_to_frontend(_round_trip(notification, Notification))
    assert payload["createdAt"] == notification.created_at.isoformat()


def test_story_from_astra_serializes_and_compares_expiry():
    """Regression: `story.expires_at <= now_utc()` raised TypeError on a str."""
    story = Story(author_id="a1", expires_at=now_utc() + timedelta(hours=1))
    restored = _round_trip(story, Story)
    assert isinstance(restored.expires_at, datetime)
    assert restored.expires_at > now_utc()
    assert story_to_frontend(restored)["expiresAt"]


def test_iso_fmt_tolerates_strings_and_none():
    stamp = now_utc().isoformat()
    assert iso_fmt(stamp) == stamp
    assert iso_fmt(None) == ""
    naive = datetime(2024, 1, 1, 12, 0, 0)
    assert iso_fmt(naive) == "2024-01-01T12:00:00+00:00"
    assert iso_fmt(naive.replace(tzinfo=timezone.utc)).startswith("2024-01-01T12:00:00")
