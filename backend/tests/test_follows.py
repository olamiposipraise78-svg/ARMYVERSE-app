"""Follow tests including duplicate prevention and self-follow validation."""


def test_follow_user(client, auth_headers, make_user):
    target = make_user("followtarget")
    ctx = auth_headers("followfan")
    r = client.post(f"/api/users/{target['id']}/follow", headers=ctx["auth"])
    assert r.status_code == 200
    assert r.json()["following"] is True
    # target's follower count reflects it
    profile = client.get(f"/api/users/{target['id']}").json()["user"]
    assert profile["followers"] == 1


def test_follow_requires_auth(client, make_user):
    target = make_user("freq")
    assert client.post(f"/api/users/{target['id']}/follow").status_code == 401


def test_duplicate_follow_prevented(client, auth_headers, make_user):
    target = make_user("duptarget")
    ctx = auth_headers("dupfan")
    client.post(f"/api/users/{target['id']}/follow", headers=ctx["auth"])
    r = client.post(f"/api/users/{target['id']}/follow", headers=ctx["auth"])
    assert r.status_code == 200
    # count unchanged
    profile = client.get(f"/api/users/{target['id']}").json()["user"]
    assert profile["followers"] == 1


def test_self_follow_forbidden(client, auth_headers):
    ctx = auth_headers("selffollow")
    r = client.post(f"/api/users/{ctx['user']['id']}/follow", headers=ctx["auth"])
    assert r.status_code == 400


def test_follow_nonexistent_user(client, auth_headers):
    ctx = auth_headers("fnon")
    r = client.post("/api/users/nonexistent/follow", headers=ctx["auth"])
    assert r.status_code == 404


def test_unfollow(client, auth_headers, make_user):
    target = make_user("unfollowtarget")
    ctx = auth_headers("unfollowfan")
    client.post(f"/api/users/{target['id']}/follow", headers=ctx["auth"])
    r = client.delete(f"/api/users/{target['id']}/follow", headers=ctx["auth"])
    assert r.status_code == 200
    assert r.json()["following"] is False
    profile = client.get(f"/api/users/{target['id']}").json()["user"]
    assert profile["followers"] == 0


def test_follow_notification_created(client, auth_headers, make_user):
    target = make_user("notiftarget")
    ctx = auth_headers("notiffan")
    client.post(f"/api/users/{target['id']}/follow", headers=ctx["auth"])
    # target sees notification. Need target's auth token.
    tctx = client.post(
        "/api/auth/login",
        json={"identifier": "notiftarget", "password": "password123"},
    ).json()
    r = client.get(
        "/api/notifications", headers={"Authorization": f"Bearer {tctx['access_token']}"}
    )
    types = [n["type"] for n in r.json()["notifications"]]
    assert "follow" in types
