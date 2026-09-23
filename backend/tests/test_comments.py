"""Comment tests including ownership and validation."""


def _make_post(client, auth, caption="post"):
    return client.post("/api/posts", json={"caption": caption}, headers=auth).json()["post"]


def test_create_comment(client, auth_headers):
    author = auth_headers("cmtauthor")["auth"]
    post = _make_post(client, author)
    commenter = auth_headers("commenter")["auth"]
    r = client.post(
        f"/api/posts/{post['id']}/comments",
        json={"text": "Great post!"},
        headers=commenter,
    )
    assert r.status_code == 200
    c = r.json()["comment"]
    assert c["text"] == "Great post!"
    # comment count incremented
    assert client.get(f"/api/posts/{post['id']}").json()["post"]["commentCount"] == 1


def test_create_comment_requires_auth(client, auth_headers):
    author = auth_headers("ca")["auth"]
    post = _make_post(client, author)
    r = client.post(f"/api/posts/{post['id']}/comments", json={"text": "hi"})
    assert r.status_code == 401


def test_comment_validation(client, auth_headers):
    author = auth_headers("cv")["auth"]
    post = _make_post(client, author)
    commenter = auth_headers("cvr")["auth"]
    # empty text -> 422
    r = client.post(f"/api/posts/{post['id']}/comments", json={"text": ""}, headers=commenter)
    assert r.status_code == 422
    # too long -> 422
    r = client.post(
        f"/api/posts/{post['id']}/comments", json={"text": "x" * 600}, headers=commenter
    )
    assert r.status_code == 422


def test_list_comments(client, auth_headers):
    author = auth_headers("lauth")["auth"]
    post = _make_post(client, author)
    commenter = auth_headers("lc")["auth"]
    client.post(f"/api/posts/{post['id']}/comments", json={"text": "first"}, headers=commenter)
    client.post(f"/api/posts/{post['id']}/comments", json={"text": "second"}, headers=commenter)
    r = client.get(f"/api/posts/{post['id']}/comments")
    assert r.status_code == 200
    assert len(r.json()["comments"]) == 2


def test_delete_own_comment(client, auth_headers):
    author = auth_headers("da")["auth"]
    post = _make_post(client, author)
    commenter = auth_headers("dc")["auth"]
    c = client.post(
        f"/api/posts/{post['id']}/comments", json={"text": "mine"}, headers=commenter
    ).json()["comment"]
    r = client.delete(f"/api/comments/{c['id']}", headers=commenter)
    assert r.status_code == 200


def test_delete_others_comment_forbidden(client, auth_headers):
    author = auth_headers("koa")["auth"]
    post = _make_post(client, author)
    commenter = auth_headers("koc")["auth"]
    c = client.post(
        f"/api/posts/{post['id']}/comments", json={"text": "private"}, headers=commenter
    ).json()["comment"]
    intruder = auth_headers("koi")["auth"]
    r = client.delete(f"/api/comments/{c['id']}", headers=intruder)
    assert r.status_code == 403


def test_delete_comment_requires_auth(client, auth_headers):
    author = auth_headers("reqa")["auth"]
    post = _make_post(client, author)
    commenter = auth_headers("reqc")["auth"]
    c = client.post(
        f"/api/posts/{post['id']}/comments", json={"text": "x"}, headers=commenter
    ).json()["comment"]
    assert client.delete(f"/api/comments/{c['id']}").status_code == 401


def test_comment_notification_created(client, auth_headers):
    author_ctx = auth_headers("notifpostauthor")
    post = _make_post(client, author_ctx["auth"])
    commenter = auth_headers("notifpostcommenter")["auth"]
    client.post(
        f"/api/posts/{post['id']}/comments",
        json={"text": "Nice!"},
        headers=commenter,
    )
    r = client.get("/api/notifications", headers=author_ctx["auth"])
    types = [n["type"] for n in r.json()["notifications"]]
    assert "comment" in types
