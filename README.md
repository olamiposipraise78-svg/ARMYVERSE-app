# ARMYVERSE 💜

A full-stack BTS ARMY social platform: share posts, like, save, comment, follow
other ARMYs, and get notified. The project is split into a React frontend and a
FastAPI backend.

```
ARMYVERSE/
├── frontend/   # React + Vite single-page app
└── backend/    # FastAPI API + Astra DB (with offline in-memory fallback)
```

## Quick start

### 1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env   # edit secrets if needed
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Runs on `http://localhost:8000` (docs at `/docs`). Without Astra credentials it
uses an in-memory repository — great for local development and testing.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. The Vite dev server proxies `/api` to the
backend at `http://localhost:8000`.

Open http://localhost:5173 and register an account.

## What's wired to the backend

- **Auth** — register, login (email or username), refresh tokens, logout,
  auth-gated routes.
- **Feed & posts** — home feed, create post (caption + hashtags).
- **Social** — like, save, comment, follow/unfollow.
- **Profiles** — view by username, own profile stats, saved tab.
- **Notifications** — likes, comments, follows; mark all read.
- **Search** — users and posts.
- **Settings** — edit display name, bio, country.

The following areas still run on local mock data (no backend endpoints yet):
albums/discography, reels, community topics, and direct messages.

## Tests

```powershell
cd backend
.venv\Scripts\python -m pytest -q   # 79 tests, fully offline
```

## Docs

- [Backend README](backend/README.md) — architecture, setup, routes, security.
- API documentation: http://localhost:8000/docs (when the backend is running).

## Security

See `backend/README.md`. In short: Argon2id password hashing, JWT access +
refresh tokens, strict CORS, rate limiting, and ownership/IDOR checks.
