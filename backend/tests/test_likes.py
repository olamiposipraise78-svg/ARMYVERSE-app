"""Likes tests including duplicate prevention and notifications."""

import pytest


def _make_post(client, auth, caption="post"):
    return client.post("/api/posts", json={"caption": caption}, headers=auth).json()["post"]


def test_like_post(client, auth_headers):
    author = auth_headers("likeauthor")["auth"]
    post = _make_post(client, author)
    liker = auth_headers("liker")["auth"]
    r = client.post(f"/api/posts/{post['id']}/like", headers=liker)
    assert r.status_code == 200
    assert r.json()["liked"] is True
    assert r.json()["likeCount"] == 1


def test_like_requires_auth(client, auth_headers):
    author = auth_headers("la")["auth"]
    post = _make_post(client, author)
    assert client.post(f"/api/posts/{post['id']}/like").status_code == 401


def test_duplicate_like_prevented(client, auth_headers):
    author = auth_headers("da")["auth"]
    post = _make_post(client, author)
    liker = auth_headers("dl")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=liker)
    r = client.post(f"/api/posts/{post['id']}/like", headers=liker)
    assert r.status_code == 200
    # count stays 1, not 2
    assert r.json()["likeCount"] == 1
    assert client.get(f"/api/posts/{post['id']}").json()["post"]["likeCount"] == 1


def test_unlike(client, auth_headers):
    author = auth_headers("ua")["auth"]
    post = _make_post(client, author)
    liker = auth_headers("ul")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=liker)
    r = client.delete(f"/api/posts/{post['id']}/like", headers=liker)
    assert r.status_code == 200
    assert r.json()["liked"] is False
    assert r.json()["likeCount"] == 0


def test_like_notification_created(client, auth_headers):
    author_ctx = auth_headers("notifauthor")
    post = _make_post(client, author_ctx["auth"])
    liker = auth_headers("notifliker")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=liker)
    # Author sees a like notification
    r = client.get("/api/notifications", headers=author_ctx["auth"])
    body = r.json()
    assert body["unread_count"] >= 1
    types = [n["type"] for n in body["notifications"]]
    assert "like" in types


def test_self_like_no_notification(client, auth_headers):
    ctx = auth_headers("selfliker")
    post = _make_post(client, ctx["auth"])
    client.post(f"/api/posts/{post['id']}/like", headers=ctx["auth"])
    r = client.get("/api/notifications", headers=ctx["auth"])
    assert r.json()["unread_count"] == 0


def test_like_nonexistent_post(client, auth_headers):
    ctx = auth_headers("lk")
    assert client.post("/api/posts/nope/like", headers=ctx["auth"]).status_code == 404
