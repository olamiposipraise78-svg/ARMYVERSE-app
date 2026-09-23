"""Tests for Games (BTS Quiz) endpoints."""


class _FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    @property
    def status_code(self):
        return 200

    def json(self):
        return self.payload


class _FakeAsyncClient:
    """Stand-in for httpx.AsyncClient that returns canned Deezer responses."""

    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        self.calls.append(url)
        for track_id, payload in self.responses:
            if f"/track/{track_id}" in url:
                return _FakeResponse(payload)
        return _FakeResponse({})


def _fake_deezer_api(*responses, monkeypatch):
    import httpx

    client = _FakeAsyncClient(list(responses))
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: client)
    return client


def _register(client, username):
    payload = {
        "username": username,
        "email": f"{username}@example.com",
        "password": "password123",
        "display_name": f"Display {username}",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    return {"auth": {"Authorization": f"Bearer {r.json()['access_token']}"}}


# ── Quiz Questions ──────────────────────────────────────────────────────────


def test_get_quiz_questions(client):
    r = client.get("/api/games/quiz/questions?difficulty=easy")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["difficulty"] == "easy"
    assert data["total"] > 0
    q = data["questions"][0]
    assert "id" in q
    assert "question" in q
    assert "options" in q
    assert len(q["options"]) == 4


def test_get_quiz_questions_includes_correct_index(client):
    """Questions returned to the client must include correctIndex for answer validation."""
    r = client.get("/api/games/quiz/questions?difficulty=easy")
    for q in r.json()["questions"]:
        assert "correctIndex" in q
        assert isinstance(q["correctIndex"], int)
        assert 0 <= q["correctIndex"] < len(q["options"])


def test_get_quiz_questions_medium(client):
    r = client.get("/api/games/quiz/questions?difficulty=medium")
    assert r.status_code == 200
    assert r.json()["total"] > 0


def test_get_quiz_questions_hard(client):
    r = client.get("/api/games/quiz/questions?difficulty=hard")
    assert r.status_code == 200
    assert r.json()["total"] > 0


def test_get_quiz_questions_invalid_difficulty(client):
    r = client.get("/api/games/quiz/questions?difficulty=impossible")
    assert r.status_code == 422


def test_get_quiz_questions_by_category(client):
    r = client.get("/api/games/quiz/questions?difficulty=easy&category=members")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] > 0
    for q in data["questions"]:
        assert q["category"] == "members"


def test_get_quiz_questions_unauthenticated_ok(client):
    """Guests can play the quiz (no auth required)."""
    r = client.get("/api/games/quiz/questions?difficulty=easy")
    assert r.status_code == 200
    assert r.json()["authenticated"] is False


def test_get_quiz_questions_authenticated(client):
    ctx = _register(client, "quizuser")
    r = client.get("/api/games/quiz/questions?difficulty=easy", headers=ctx["auth"])
    assert r.status_code == 200
    assert r.json()["authenticated"] is True


# ── Submit Quiz ─────────────────────────────────────────────────────────────


def test_submit_quiz(client):
    ctx = _register(client, "quizsubmit")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 100, "difficulty": "easy", "correct": 10, "total": 10, "streak": 5},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["xp_earned"] == 100 + 5 * 5  # score + streak*5
    assert data["total_score"] == 100
    assert data["best_score"] == 100
    assert data["games_played"] == 1
    assert data["best_streak"] == 5


def test_submit_quiz_requires_auth(client):
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 50, "difficulty": "easy", "correct": 5, "total": 10, "streak": 0},
    )
    assert r.status_code == 401


def test_submit_quiz_cumulative(client):
    ctx = _register(client, "quizcum")
    client.post(
        "/api/games/quiz/submit",
        json={"score": 100, "difficulty": "easy", "correct": 10, "total": 10, "streak": 5},
        headers=ctx["auth"],
    )
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 80, "difficulty": "medium", "correct": 8, "total": 10, "streak": 3},
        headers=ctx["auth"],
    )
    data = r.json()
    assert data["games_played"] == 2
    assert data["total_score"] == 180
    assert data["best_score"] == 100


# ── Game Progress ───────────────────────────────────────────────────────────


def test_get_progress_no_games(client):
    ctx = _register(client, "progress0")
    r = client.get("/api/games/progress", headers=ctx["auth"])
    assert r.status_code == 200
    data = r.json()["progress"]
    assert data["xp"] == 0
    assert data["games_played"] == 0


def test_get_progress_after_play(client):
    ctx = _register(client, "prog1")
    client.post(
        "/api/games/quiz/submit",
        json={"score": 200, "difficulty": "hard", "correct": 9, "total": 10, "streak": 7},
        headers=ctx["auth"],
    )
    r = client.get("/api/games/progress", headers=ctx["auth"])
    progress = r.json()["progress"]
    assert progress["xp"] == 200 + 7 * 5
    assert progress["games_played"] == 1
    assert progress["best_score"] == 200
    assert len(progress["quiz_history"]) == 1


def test_get_progress_requires_auth(client):
    r = client.get("/api/games/progress")
    assert r.status_code == 401


# ── Categories ──────────────────────────────────────────────────────────────


def test_get_categories(client):
    r = client.get("/api/games/categories")
    assert r.status_code == 200
    cats = r.json()["categories"]
    assert isinstance(cats, list)
    assert "members" in cats
    assert "songs" in cats
    assert len(cats) == 6


# ── Scoring Accuracy Tests ──────────────────────────────────────────────────


def test_submit_quiz_zero_correct(client):
    """0 correct out of 10 should report correct=0, total=10."""
    ctx = _register(client, "score0")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 0, "difficulty": "easy", "correct": 0, "total": 10, "streak": 0},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total_score"] == 0
    assert data["best_score"] == 0
    assert data["best_streak"] == 0
    # xp_earned = score(0) + streak*5(0) = 0
    assert data["xp_earned"] == 0


def test_submit_quiz_five_correct(client):
    """5 correct out of 10 should report correct=5, total=10."""
    ctx = _register(client, "score5")
    # Easy: 5 correct * 100 base = 500 score (no time/streak bonuses)
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 500, "difficulty": "easy", "correct": 5, "total": 10, "streak": 3},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total_score"] == 500
    assert data["best_score"] == 500
    assert data["best_streak"] == 3
    # xp_earned = score(500) + streak*5(15) = 515
    assert data["xp_earned"] == 515


def test_submit_quiz_seven_correct(client):
    """7 correct out of 10 should report correct=7, total=10."""
    ctx = _register(client, "score7")
    # Easy: 7 correct * 100 base = 700 score
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 700, "difficulty": "easy", "correct": 7, "total": 10, "streak": 5},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total_score"] == 700
    assert data["best_score"] == 700
    # xp_earned = score(700) + streak*5(25) = 725
    assert data["xp_earned"] == 725


def test_submit_quiz_ten_correct(client):
    """10 correct out of 10 should report correct=10, total=10."""
    ctx = _register(client, "score10")
    # Easy: 10 correct * 100 base = 1000 score
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 1000, "difficulty": "easy", "correct": 10, "total": 10, "streak": 10},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total_score"] == 1000
    assert data["best_score"] == 1000
    assert data["best_streak"] == 10
    # xp_earned = score(1000) + streak*5(50) = 1050
    assert data["xp_earned"] == 1050


def test_submit_quiz_stores_correct_in_history(client):
    """Quiz history must store the exact correct count passed from the frontend."""
    ctx = _register(client, "historycheck")
    client.post(
        "/api/games/quiz/submit",
        json={"score": 500, "difficulty": "easy", "correct": 5, "total": 10, "streak": 2},
        headers=ctx["auth"],
    )
    r = client.get("/api/games/progress", headers=ctx["auth"])
    history = r.json()["progress"]["quiz_history"]
    assert len(history) == 1
    assert history[0]["correct"] == 5
    assert history[0]["total"] == 10
    assert history[0]["difficulty"] == "easy"


def test_submit_quiz_correct_cannot_exceed_total(client):
    """Backend rejects correct > total."""
    ctx = _register(client, "overflow")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 100, "difficulty": "easy", "correct": 11, "total": 10, "streak": 0},
        headers=ctx["auth"],
    )
    assert r.status_code == 400


def test_submit_quiz_correct_cannot_be_negative(client):
    """Backend rejects negative correct count."""
    ctx = _register(client, "negscore")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 0, "difficulty": "easy", "correct": -1, "total": 10, "streak": 0},
        headers=ctx["auth"],
    )
    assert r.status_code == 400


def test_submit_quiz_medium_five_correct(client):
    """5 correct on medium difficulty with streak bonuses."""
    ctx = _register(client, "med5")
    # Medium: 5 correct * 200 base = 1000 score
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 1000, "difficulty": "medium", "correct": 5, "total": 10, "streak": 4},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_score"] == 1000
    # xp_earned = score(1000) + streak*5(20) = 1020
    assert data["xp_earned"] == 1020


def test_submit_quiz_hard_seven_correct(client):
    """7 correct on hard difficulty."""
    ctx = _register(client, "hard7")
    # Hard: 7 correct * 300 base = 2100 score
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 2100, "difficulty": "hard", "correct": 7, "total": 10, "streak": 6},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_score"] == 2100
    # xp_earned = score(2100) + streak*5(30) = 2130
    assert data["xp_earned"] == 2130


# ── Game Type Tests ─────────────────────────────────────────────────────────


def test_submit_guess_song(client):
    """Guess the Song results are stored with game_type."""
    ctx = _register(client, "guessong")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 800, "difficulty": "medium", "correct": 8, "total": 10, "streak": 4, "game_type": "guess-song"},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total_score"] == 800


def test_submit_guess_member(client):
    """Guess the Member results are stored with game_type."""
    ctx = _register(client, "guessmem")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 700, "difficulty": "easy", "correct": 7, "total": 10, "streak": 3, "game_type": "guess-member"},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total_score"] == 700


def test_submit_memory_game(client):
    """Memory Game results are stored with game_type."""
    ctx = _register(client, "memgame")
    r = client.post(
        "/api/games/quiz/submit",
        json={"score": 500, "difficulty": "easy", "correct": 8, "total": 8, "streak": 0, "game_type": "memory"},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True


def test_submit_game_type_stored_in_history(client):
    """game_type is preserved in quiz history."""
    ctx = _register(client, "gtype")
    client.post(
        "/api/games/quiz/submit",
        json={"score": 300, "difficulty": "easy", "correct": 3, "total": 10, "streak": 1, "game_type": "guess-song"},
        headers=ctx["auth"],
    )
    r = client.get("/api/games/progress", headers=ctx["auth"])
    history = r.json()["progress"]["quiz_history"]
    assert len(history) == 1
    assert history[0]["game_type"] == "guess-song"


def test_submit_default_game_type_is_quiz(client):
    """Default game_type is 'quiz' when not provided."""
    ctx = _register(client, "gdefault")
    client.post(
        "/api/games/quiz/submit",
        json={"score": 100, "difficulty": "easy", "correct": 1, "total": 10, "streak": 0},
        headers=ctx["auth"],
    )
    r = client.get("/api/games/progress", headers=ctx["auth"])
    history = r.json()["progress"]["quiz_history"]
    assert history[0]["game_type"] == "quiz"


# ── Song Preview Proxies ────────────────────────────────────────────────────


def test_get_song_previews_returns_urls(client, monkeypatch):
    _fake_deezer_api(
        (100001, {"id": 100001, "preview": "https://cdnt-preview.dzcdn.net/a.mp3"}),
        (100002, {"id": 100002, "preview": "https://cdnt-preview.dzcdn.net/b.mp3"}),
        monkeypatch=monkeypatch,
    )
    r = client.post("/api/games/songs/previews", json={"deezerIds": [100001, 100002]})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["previews"]["100001"] == "https://cdnt-preview.dzcdn.net/a.mp3"
    assert data["previews"]["100002"] == "https://cdnt-preview.dzcdn.net/b.mp3"


def test_get_song_previews_caches_results(client, monkeypatch):
    fake = _fake_deezer_api(
        (100003, {"id": 100003, "preview": "https://cdnt-preview.dzcdn.net/c.mp3"}),
        monkeypatch=monkeypatch,
    )
    r1 = client.post("/api/games/songs/previews", json={"deezerIds": [100003]})
    assert r1.json()["previews"]["100003"] == "https://cdnt-preview.dzcdn.net/c.mp3"
    r2 = client.post("/api/games/songs/previews", json={"deezerIds": [100003]})
    assert r2.json()["previews"]["100003"] == "https://cdnt-preview.dzcdn.net/c.mp3"
    # Only the first call should hit the Deezer API.
    assert len(fake.calls) == 1


def test_get_song_previews_skips_tracks_without_preview(client, monkeypatch):
    _fake_deezer_api(
        (100004, {"id": 100004, "preview": "https://cdnt-preview.dzcdn.net/d.mp3"}),
        (100005, {"id": 100005}),  # no preview field
        monkeypatch=monkeypatch,
    )
    r = client.post("/api/games/songs/previews", json={"deezerIds": [100004, 100005]})
    assert r.status_code == 200
    data = r.json()
    assert "100004" in data["previews"]
    assert "100005" not in data["previews"]


def test_get_song_previews_rejects_empty_list(client):
    r = client.post("/api/games/songs/previews", json={"deezerIds": []})
    assert r.status_code == 422


def test_get_song_previews_refetches_after_ttl(client, monkeypatch):
    """Expired cached preview URLs are re-resolved from Deezer."""
    import time

    import app.api.routes.games as games

    fake = _fake_deezer_api(
        (100006, {"id": 100006, "preview": "https://cdnt-preview.dzcdn.net/fresh.mp3"}),
        monkeypatch=monkeypatch,
    )
    r1 = client.post("/api/games/songs/previews", json={"deezerIds": [100006]})
    assert r1.json()["previews"]["100006"] == "https://cdnt-preview.dzcdn.net/fresh.mp3"
    assert len(fake.calls) == 1

    # Backdate the cache entry beyond the TTL so the URL must be re-fetched.
    url, _ = games._preview_cache[100006]
    games._preview_cache[100006] = (
        url,
        time.time() - games._PREVIEW_CACHE_TTL_SECONDS - 10,
    )

    r2 = client.post("/api/games/songs/previews", json={"deezerIds": [100006]})
    assert r2.json()["previews"]["100006"] == "https://cdnt-preview.dzcdn.net/fresh.mp3"
    assert len(fake.calls) == 2
