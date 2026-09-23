# ARMYVERSE Backend

FastAPI backend for ARMYVERSE, a BTS ARMY social platform. It powers the React
frontend's core features: authentication, users/profiles, posts, likes, saves,
comments, follows, notifications, feed, and search.

## Architecture

```
Routes (FastAPI) -> Services -> Repository -> Storage (Astra DB or in-memory)
                                      ^
                                (selected at startup)
```

- `app/api/routes/` — HTTP handlers, auth, validation, rate limits.
- `app/services/` — business logic and authorisation/ownership rules.
- `app/repositories/` — persistence contract + two implementations:
  - `MemoryRepository` — offline, in-process (used for dev without Astra and for tests).
  - `AstraRepository` — real DataStax Astra DB via the `astrapy` driver.
- `app/serializers/` — maps internal model records to frontend API shapes.
- `app/core/` — config, security (Argon2id + JWT), errors, rate limiting, DB factory.

The correct storage layer is chosen automatically: if `ASTRA_DB_API_ENDPOINT`
and `ASTRA_DB_APPLICATION_TOKEN` are present in the environment, the app uses
`AstraRepository`; otherwise it falls back to `MemoryRepository`.

## Requirements

- Python 3.14 (see `requirements.txt` for pinned, cp314-wheeled versions).

## Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # then fill in JWT secrets / Astra credentials
```

## Run

```powershell
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Interactive API docs: http://127.0.0.1:8000/docs

## Test

Tests run fully offline against a fresh in-memory repository. Set
`RATELIMIT_ENABLED=false` (already done in `tests/conftest.py`) to disable rate
limits during tests.

```powershell
.venv\Scripts\python -m pytest -q
```

## Environment variables

See `.env.example`. Key ones:

| Variable | Purpose |
| --- | --- |
| `ASTRA_DB_API_ENDPOINT` / `ASTRA_DB_APPLICATION_TOKEN` | Enable real Astra DB |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Sign JWTs (use long random strings) |
| `FRONTEND_URL` | CORS allow-list origin for the frontend |
| `RATE_LIMIT_*_PER_MIN` | Rate limiting (requests/minute) |
| `RATELIMIT_ENABLED` | Set `false` to disable rate limiting entirely (tests) |

## Security notes

- Passwords hashed with **Argon2id** (never stored in plaintext).
- **JWT** access + refresh token flow.
- **CORS** restricts origins to `FRONTEND_URL` (no wildcard in production).
- **Rate limiting** via slowapi.
- **Ownership / IDOR checks** — users can only edit/delete their own posts,
  comments, and notifications; protected fields (`id`, `email`, password hash,
  roles/`verified`, `createdAt`) can never be modified via `PATCH /api/users/me`
  because only whitelisted fields are ever applied.
- Errors return generic messages without leaking internals.
```
