"""Saved-posts tests including duplicate prevention and isolation."""


def _make_post(client, auth, caption="post"):
    return client.post("/api/posts", json={"caption": caption}, headers=auth).json()["post"]


def test_save_post(client, auth_headers):
    author = auth_headers("saveauthor")["auth"]
    post = _make_post(client, author)
    saver = auth_headers("saver")["auth"]
    r = client.post(f"/api/posts/{post['id']}/save", headers=saver)
    assert r.status_code == 200
    assert r.json()["saved"] is True


def test_save_requires_auth(client, auth_headers):
    author = auth_headers("sva")["auth"]
    post = _make_post(client, author)
    assert client.post(f"/api/posts/{post['id']}/save").status_code == 401


def test_duplicate_save_no_duplicate(client, auth_headers):
    author = auth_headers("dupsavea")["auth"]
    post = _make_post(client, author)
    saver = auth_headers("dupsaver")["auth"]
    client.post(f"/api/posts/{post['id']}/save", headers=saver)
    r = client.post(f"/api/posts/{post['id']}/save", headers=saver)
    assert r.status_code == 200
    # in "my saved" it appears once
    saved = client.get("/api/users/me/saved", headers=saver).json()["saved"]
    matches = [p for p in saved if p["id"] == post["id"]]
    assert len(matches) == 1


def test_unsave(client, auth_headers):
    author = auth_headers("usavea")["auth"]
    post = _make_post(client, author)
    saver = auth_headers("usaver")["auth"]
    client.post(f"/api/posts/{post['id']}/save", headers=saver)
    r = client.delete(f"/api/posts/{post['id']}/save", headers=saver)
    assert r.status_code == 200
    assert r.json()["saved"] is False
    saved = client.get("/api/users/me/saved", headers=saver).json()["saved"]
    assert all(p["id"] != post["id"] for p in saved)


def test_saved_isolated_per_user(client, auth_headers):
    author = auth_headers("isoa")["auth"]
    post = _make_post(client, author)
    s1 = auth_headers("iso1")["auth"]
    s2 = auth_headers("iso2")["auth"]
    client.post(f"/api/posts/{post['id']}/save", headers=s1)
    # user 2 sees nothing saved
    saved2 = client.get("/api/users/me/saved", headers=s2).json()["saved"]
    assert saved2 == []
    # user 1 sees it
    saved1 = client.get("/api/users/me/saved", headers=s1).json()["saved"]
    assert len(saved1) == 1


def test_my_saved_requires_auth(client):
    assert client.get("/api/users/me/saved").status_code == 401


def test_save_nonexistent_post(client, auth_headers):
    ctx = auth_headers("svn")
    assert client.post("/api/posts/nope/save", headers=ctx["auth"]).status_code == 404
