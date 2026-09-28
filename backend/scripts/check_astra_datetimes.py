"""Read-only smoke check of the Astra datetime round-trip against the real DB.

Fetches a few documents of each kind, rebuilds the models through the same
_from_doc path the API uses, and runs them through the frontend serializers.
Writes nothing.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from astrapy import DataAPIClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.models import Notification, Post, Story, User  # noqa: E402
from app.repositories.astra import AstraRepository  # noqa: E402
from app.serializers.frontend import (  # noqa: E402
    notification_to_frontend,
    post_to_frontend,
    story_to_frontend,
    user_to_frontend,
)

CHECKS = [
    ("users", User, user_to_frontend),
    ("posts", Post, post_to_frontend),
    ("notifications", Notification, notification_to_frontend),
    ("stories", Story, story_to_frontend),
]

settings = get_settings()
database = DataAPIClient(settings.astra_db_application_token).get_database(
    settings.astra_db_api_endpoint,
    keyspace=settings.astra_db_keyspace or None,
)

failures = 0
for name, model_cls, serializer in CHECKS:
    docs = list(database.get_collection(name).find(limit=3))
    if not docs:
        print(f"{name:<14} no documents, skipped")
        continue
    for doc in docs:
        stored = doc.get("created_at")
        model = AstraRepository._from_doc(model_cls, doc)
        try:
            created = serializer(model).get("createdAt")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"{name:<14} FAIL {type(exc).__name__}: {exc}")
            print(f"{'':<14}      stored created_at={stored!r}")
            continue
        print(
            f"{name:<14} ok   stored={type(stored).__name__:<4} "
            f"-> model={type(model.created_at).__name__:<8} -> createdAt={created}"
        )

print()
print("FAILURES:", failures)
sys.exit(1 if failures else 0)
