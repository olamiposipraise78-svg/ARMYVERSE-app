"""Notifications tests including isolation (IDOR) boundaries."""


def _make_post(client, auth, caption="post"):
    return client.post("/api/posts", json={"caption": caption}, headers=auth).json()["post"]


def test_create_notifications_and_list(client, auth_headers):
    author_ctx = auth_headers("nauthor")
    post = _make_post(client, author_ctx["auth"])
    actor = auth_headers("nactor")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=actor)
    client.post(f"/api/posts/{post['id']}/comments", json={"text": "yo"}, headers=actor)
    r = client.get("/api/notifications", headers=author_ctx["auth"])
    assert r.status_code == 200
    assert r.json()["unread_count"] >= 1
    assert len(r.json()["notifications"]) >= 1


def test_notifications_require_auth(client):
    assert client.get("/api/notifications").status_code == 401


def test_cannot_read_others_notifications(client, auth_headers, make_user):
    # user A creates activity for user B
    b_ctx = auth_headers("targetb")
    post = _make_post(client, b_ctx["auth"])
    actor = auth_headers("actora")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=actor)
    # actor A must not see B's notifications
    r = client.get("/api/notifications", headers=actor)
    assert r.status_code == 200
    assert r.json()["notifications"] == []
    assert r.json()["unread_count"] == 0


def test_mark_one_read(client, auth_headers):
    author_ctx = auth_headers("ronea")
    post = _make_post(client, author_ctx["auth"])
    actor = auth_headers("roneactor")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=actor)
    notif_list = client.get("/api/notifications", headers=author_ctx["auth"]).json()["notifications"]
    nid = notif_list[0]["id"]
    r = client.patch(f"/api/notifications/{nid}/read", headers=author_ctx["auth"])
    assert r.status_code == 200
    assert r.json()["notification"]["read"] is True
    # unread decreased
    unread = client.get("/api/notifications", headers=author_ctx["auth"]).json()["unread_count"]
    assert unread == 0


def test_cannot_mark_others_notification_read(client, auth_headers):
    b_ctx = auth_headers("markb")
    post = _make_post(client, b_ctx["auth"])
    actor = auth_headers("markactor")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=actor)
    nid = client.get("/api/notifications", headers=b_ctx["auth"]).json()["notifications"][0]["id"]
    # actor tries to mark B's notification read -> 403
    r = client.patch(f"/api/notifications/{nid}/read", headers=actor)
    assert r.status_code == 403


def test_mark_all_read(client, auth_headers):
    author_ctx = auth_headers("allreada")
    post = _make_post(client, author_ctx["auth"])
    actor = auth_headers("allreadactor")["auth"]
    client.post(f"/api/posts/{post['id']}/like", headers=actor)
    r = client.patch("/api/notifications/read-all", headers=author_ctx["auth"])
    assert r.status_code == 200
    assert r.json()["updated"] >= 1
    unread = client.get("/api/notifications", headers=author_ctx["auth"]).json()["unread_count"]
    assert unread == 0
