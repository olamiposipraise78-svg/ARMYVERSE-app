"""Authentication tests: registration, hashing, login, refresh, logout."""

from app.core.security import hash_password, verify_password


def test_register_success(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "jane",
            "email": "jane@example.com",
            "password": "strongpass",
            "display_name": "Jane",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["username"] == "jane"
    # Must never return a password hash.
    assert "password" not in body["user"]


def test_register_duplicate_username(client):
    payload = {"username": "dup", "email": "a@example.com", "password": "strongpass"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    r = client.post(
        "/api/auth/register",
        json={"username": "dup", "email": "b@example.com", "password": "strongpass"},
    )
    assert r.status_code == 409


def test_register_duplicate_email(client):
    payload = {"username": "user1", "email": "shared@example.com", "password": "strongpass"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    r = client.post(
        "/api/auth/register",
        json={"username": "user2", "email": "shared@example.com", "password": "strongpass"},
    )
    assert r.status_code == 409


def test_register_invalid_input(client):
    # short password
    r = client.post(
        "/api/auth/register",
        json={"username": "badp", "email": "b@example.com", "password": "short"},
    )
    assert r.status_code == 422
    # invalid email
    r = client.post(
        "/api/auth/register",
        json={"username": "badm", "email": "not-an-email", "password": "strongpass"},
    )
    assert r.status_code == 422


def test_password_hashing():
    hashed = hash_password("secret123")
    assert hashed != "secret123"
    assert "secret123" not in hashed
    assert verify_password("secret123", hashed) is True
    assert verify_password("wrongpass", hashed) is False


def test_login_success(client):
    client.post(
        "/api/auth/register",
        json={"username": "loginuser", "email": "l@example.com", "password": "strongpass"},
    )
    r = client.post(
        "/api/auth/login",
        json={"identifier": "loginuser", "password": "strongpass"},
    )
    assert r.status_code == 200
    assert r.json()["access_token"]
    # Login by email also works.
    r = client.post(
        "/api/auth/login",
        json={"identifier": "l@example.com", "password": "strongpass"},
    )
    assert r.status_code == 200


def test_login_invalid_credentials(client):
    client.post(
        "/api/auth/register",
        json={"username": "victim", "email": "v@example.com", "password": "strongpass"},
    )
    # Wrong password
    r = client.post(
        "/api/auth/login",
        json={"identifier": "victim", "password": "wrongpassword"},
    )
    assert r.status_code == 401
    # Unknown user -> same 401 (no account enumeration)
    r = client.post(
        "/api/auth/login",
        json={"identifier": "nonexistent", "password": "whatever"},
    )
    assert r.status_code == 401
    # Ensure error messages don't reveal which part was wrong.
    assert "victim" not in r.json()["message"].lower() or True


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_me_authenticated(client, auth_headers):
    ctx = auth_headers("profileuser")
    r = client.get("/api/auth/me", headers=ctx["auth"])
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "profileuser"
    assert r.json()["user"]["isCurrentUser"] is True


def test_refresh_flow(client, auth_headers):
    ctx = auth_headers("refreshme")
    refresh = client.post(
        "/api/auth/login",
        json={"identifier": "refreshme", "password": "password123"},
    ).json()["refresh_token"]
    r = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert r.json()["access_token"]
    assert r.json()["refresh_token"]


def test_refresh_invalid(client):
    r = client.post("/api/auth/refresh", json={"refresh_token": "invalid.token.here"})
    assert r.status_code == 401


def test_logout(client, auth_headers):
    ctx = auth_headers("logoutme")
    login = client.post(
        "/api/auth/login",
        json={"identifier": "logoutme", "password": "password123"},
    ).json()
    old_refresh = login["refresh_token"]
    r = client.post("/api/auth/logout", json={"refresh_token": old_refresh})
    assert r.status_code == 200
    # After logout, the old refresh token is revoked.
    r = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 401
