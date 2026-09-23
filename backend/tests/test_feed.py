"""Feed and search tests."""


def _make_post(client, auth, caption="post", **extra):
    payload = {"caption": caption}
    payload.update(extra)
    return client.post("/api/posts", json=payload, headers=auth).json()["post"]


def test_feed_requires_auth(client):
    assert client.get("/api/feed").status_code == 401


def test_feed_returns_posts(client, auth_headers):
    ctx = auth_headers("feeduser")
    _make_post(client, ctx["auth"], caption="my first feed post")
    r = client.get("/api/feed", headers=ctx["auth"])
    assert r.status_code == 200
    assert len(r.json()["posts"]) == 1
    assert r.json()["posts"][0]["text"] == "my first feed post"


def test_feed_includes_followed_users_posts(client, auth_headers, make_user):
    # A follows B; B posts; A's feed includes B's post.
    b = make_user("feedbeebee")
    a_ctx = auth_headers("feedaye")
    client.post(f"/api/users/{b['id']}/follow", headers=a_ctx["auth"])
    b_login = client.post(
        "/api/auth/login", json={"identifier": "feedbeebee", "password": "password123"}
    ).json()
    b_auth = {"Authorization": f"Bearer {b_login['access_token']}"}
    _make_post(client, b_auth, caption="from B")
    r = client.get("/api/feed", headers=a_ctx["auth"])
    texts = [p["text"] for p in r.json()["posts"]]
    assert "from B" in texts


def test_unauthenticated_feed_rejected(client):
    assert client.get("/api/feed").status_code == 401


def test_feed_pagination(client, auth_headers):
    ctx = auth_headers("feedpag")
    for i in range(3):
        _make_post(client, ctx["auth"], caption=f"feed {i}")
    r = client.get("/api/feed?page_size=2", headers=ctx["auth"])
    assert len(r.json()["posts"]) == 2
    assert r.json()["has_more"] is True


def test_search_users(client, auth_headers, make_user):
    make_user("kimnamjoon")
    make_user("kimseokjin")
    ctx = auth_headers("searchx")
    r = client.get("/api/search/users?q=kim", headers=ctx["auth"])
    assert r.status_code == 200
    usernames = [u["username"] for u in r.json()["users"]]
    assert "kimnamjoon" in usernames
    assert "kimseokjin" in usernames


def test_search_users_requires_query(client, auth_headers):
    ctx = auth_headers("searchq")
    # FastAPI/Pydantic validation returns 422 for an empty required query.
    assert client.get("/api/search/users?q=", headers=ctx["auth"]).status_code == 422


def test_search_posts(client, auth_headers):
    ctx = auth_headers("searchpost")
    _make_post(client, ctx["auth"], caption="purple ocean vibes")
    r = client.get("/api/search/posts?q=purple", headers=ctx["auth"])
    assert r.status_code == 200
    texts = [p["text"] for p in r.json()["posts"]]
    assert "purple ocean vibes" in texts


def test_search_posts_by_hashtag(client, auth_headers):
    ctx = auth_headers("searchtag")
    _make_post(client, ctx["auth"], caption="hello", hashtags=["#Borahae"])
    r = client.get("/api/search/posts?q=Borahae", headers=ctx["auth"])
    assert r.status_code == 200
    assert len(r.json()["posts"]) == 1


def test_search_posts_requires_auth(client):
    assert client.get("/api/search/posts?q=x").status_code == 401
