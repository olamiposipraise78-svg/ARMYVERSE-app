"""User/profile tests and authorisation boundaries."""

import pytest


def test_get_user_public(client, make_user):
    u = make_user("publicuser")
    r = client.get(f"/api/users/{u['id']}")
    assert r.status_code == 200
    data = r.json()["user"]
    assert data["username"] == "publicuser"
    # password hash must never be exposed
    assert "password" not in data
    assert "email" not in data  # email is private


def test_get_user_by_username(client, make_user):
    u = make_user("byusername")
    r = client.get(f"/api/users/{u['username']}")
    assert r.status_code == 200
    assert r.json()["user"]["id"] == u["id"]
    assert r.json()["user"]["username"] == "byusername"


def test_get_user_not_found(client):
    r = client.get("/api/users/nonexistent-id")
    assert r.status_code == 404


def test_update_me(client, auth_headers):
    ctx = auth_headers("profileupd")
    r = client.patch(
        "/api/users/me",
        json={"display_name": "New Name", "bio": "Hello ARMY"},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()["user"]
    assert data["displayName"] == "New Name"
    assert data["bio"] == "Hello ARMY"


def test_update_me_requires_auth(client):
    r = client.patch("/api/users/me", json={"display_name": "x"})
    assert r.status_code == 401


def test_update_me_protected_fields_ignored(client, auth_headers):
    ctx = auth_headers("protectx")
    r = client.patch(
        "/api/users/me",
        json={
            "display_name": "Keep",
            "id": "hacked-id",
            "email": "attacker@example.com",
            "verified": True,
        },
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()["user"]
    assert data["id"] != "hacked-id"
    assert data["displayName"] == "Keep"


def test_update_other_user_forbidden(client, make_user, auth_headers):
    other = make_user("otheruser")
    ctx = auth_headers("realowner")
    # Attempting to use the users/me endpoint always acts on the token owner.
    r = client.patch(
        "/api/users/me",
        json={"display_name": "Spoofed"},
        headers=ctx["auth"],
    )
    assert r.json()["user"]["id"] == ctx["user"]["id"]
    assert r.json()["user"]["displayName"] == "Spoofed"
    # Other user is untouched.
    r2 = client.get(f"/api/users/{other['id']}")
    assert r2.json()["user"]["displayName"] == "Display otheruser"


def test_followers_and_following(client, make_user, auth_headers):
    ra = auth_headers("usera")
    a = ra["user"]
    b = make_user("userb")
    # a follows b
    r = client.post(f"/api/users/{b['id']}/follow", headers=ra["auth"])
    assert r.status_code == 200
    # b's followers include a
    r = client.get(f"/api/users/{b['id']}/followers")
    assert r.status_code == 200
    ids = [u["id"] for u in r.json()["users"]]
    assert a["id"] in ids
    # a's following include b
    r = client.get(f"/api/users/{a['id']}/following")
    ids = [u["id"] for u in r.json()["users"]]
    assert b["id"] in ids


def test_followers_list_not_found(client):
    r = client.get("/api/users/nonexistent/followers")
    assert r.status_code == 404
